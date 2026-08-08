//! Shapes the command boundary needs, and the decisions it makes about text
//! that the cloud RPCs make in SQL.
//!
//! Every one of them is a port of something the live RPCs do with `NULLIF`, a
//! cast or a `jsonb ?` test, and every one of them is easy to lose because in
//! Postgres it is punctuation rather than a statement.
//!
//! # The three-state problem, and why `Option` cannot express it
//!
//! `update_transaction_atomic` distinguishes **three** states per field, not
//! two, and the difference between them is the difference between "leave my
//! notes alone" and "delete my notes":
//!
//! | JSON | `p ? 'k'` | `p->>'k'` | the RPC |
//! | --- | --- | --- | --- |
//! | key absent | false | NULL | leave it alone |
//! | `"k": null` | **true** | NULL | depends on the field's shape |
//! | `"k": "x"` | true | `x` | set it |
//!
//! A Rust `Option<String>` collapses the first two into `None`. [`Field`] keeps
//! them apart, because AUDIT3 §1 measured fourteen fields across four
//! behaviours and *two* of those behaviours turn on exactly this distinction.

use serde::{Deserialize, Deserializer};

/// A value the RPC reads with `->>`, which yields text whether the caller sent
/// a JSON number or a JSON string.
///
/// `NULLIF(p->>'statement_sequence','')::integer` therefore accepts `7`, `"7"`
/// and `""` (which becomes NULL). Reproduced rather than tightened, because an
/// importer that has always sent strings would otherwise start failing at the
/// local edition and nowhere else.
#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum Ordinal {
    /// `7`
    Number(i64),
    /// `"7"`, or `""` for absent.
    Text(String),
}

impl Ordinal {
    /// Resolve to the integer the column stores.
    ///
    /// # Errors
    /// The message a caller sees when the text is not an integer — the local
    /// twin of Postgres's `invalid input syntax for type integer`.
    pub fn resolve(&self) -> Result<Option<i64>, String> {
        match self {
            Self::Number(value) => Ok(Some(*value)),
            Self::Text(text) if text.is_empty() => Ok(None),
            Self::Text(text) => text
                .parse::<i64>()
                .map(Some)
                .map_err(|_| format!("statement_sequence is not an integer: {text:?}")),
        }
    }
}

/// A boolean as the RPCs receive one: `(p->>'k')::boolean`.
///
/// `->>` yields **text**, so every boolean in every one of these RPCs arrives
/// at a Postgres cast, and that cast accepts a great deal more than `true` and
/// `false`. An `Option<bool>` here would refuse `"is_cleared": "true"` — which
/// the cloud accepts — and, worse, would refuse `""` with a *deserialiser* error
/// rather than the named refusal the sentinel table (AUDIT3 §1) is about.
///
/// So the accepted set is Postgres's own, enumerated rather than guessed.
/// MEASURED against the reference cluster, 2026-08-08, one `psql` cast per
/// value:
///
/// ```text
/// t tr tru true y ye yes on 1     -> true
/// f fa fal fals false n no of off 0 -> false
/// o  ""  2  banana                -> invalid input syntax for type boolean
/// ```
///
/// `o` is the interesting one: it is a prefix of both `on` and `off`, and
/// Postgres refuses ambiguity. Leading and trailing whitespace is ignored and
/// case does not matter.
#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum Flag {
    /// `true` / `false`, as JSON spells them.
    Bool(bool),
    /// `"t"`, `"yes"`, `"off"`, … or `""`, which is a refusal.
    Text(String),
}

impl Flag {
    /// Resolve to the 0/1 the column stores.
    ///
    /// # Errors
    /// The message a caller sees when the text is not a boolean — the local
    /// twin of Postgres's `invalid input syntax for type boolean`.
    pub fn resolve(&self) -> Result<bool, String> {
        let text = match self {
            Self::Bool(value) => return Ok(*value),
            Self::Text(text) => text.trim().to_ascii_lowercase(),
        };
        // Exactly parse_bool_with_len's table: unique prefixes of true/false/
        // yes/no, `on` and `off` in full because `o` is ambiguous, and the
        // single digits.
        match text.as_str() {
            "t" | "tr" | "tru" | "true" | "y" | "ye" | "yes" | "on" | "1" => Ok(true),
            "f" | "fa" | "fal" | "fals" | "false" | "n" | "no" | "of" | "off" | "0" => Ok(false),
            other => Err(format!(
                "invalid input syntax for type boolean: {other:?}"
            )),
        }
    }

    /// `COALESCE((p->>'k')::boolean, <fallback>)` — resolve a flag the caller
    /// may not have sent at all.
    ///
    /// # Errors
    /// As [`Flag::resolve`].
    pub fn resolve_or(flag: Option<&Self>, fallback: bool) -> Result<bool, String> {
        match flag {
            None => Ok(fallback),
            Some(flag) => flag.resolve(),
        }
    }
}

/// One field of a patch, in the three states `jsonb` can present it in.
///
/// `Default` is [`Field::Absent`], so `#[serde(default)]` on a struct field is
/// what makes "the key was not sent" a distinct value rather than a `null` in
/// disguise. It is written out rather than derived because a derived `Default`
/// would demand `T: Default`, and "absent" is a statement about the *key*, not
/// about anything the value type can supply.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Field<T> {
    /// The key was not in the object. `p ? 'k'` is false.
    Absent,
    /// The key was there and its value was JSON `null`. `p ? 'k'` is **true**
    /// and `p->>'k'` is SQL NULL — the state an `Option` cannot tell from
    /// [`Field::Absent`], and the one that clears a transfer link.
    Null,
    /// The key was there with a value. `""` is a value; it is not absence, and
    /// what it means differs per field.
    Value(T),
}

// Written out rather than derived on purpose: `#[derive(Default)]` adds a
// `T: Default` bound to every type parameter, and `Field<Flag>` would then need
// a default boolean — which is exactly the wrong idea. "The key was absent" is
// a fact about the JSON object and owes nothing to the value type.
#[allow(clippy::derivable_impls)]
impl<T> Default for Field<T> {
    fn default() -> Self {
        Self::Absent
    }
}

impl<T> Field<T> {
    /// Was the key present at all? The port of `p ? 'k'`.
    pub const fn is_present(&self) -> bool {
        !matches!(self, Self::Absent)
    }

    /// The value, if one was sent. `None` covers both absence and JSON null —
    /// use it only where the RPC's own expression is a `COALESCE`, which
    /// treats them identically on purpose.
    pub const fn value(&self) -> Option<&T> {
        match self {
            Self::Value(value) => Some(value),
            Self::Absent | Self::Null => None,
        }
    }
}

impl<'de, T: Deserialize<'de>> Deserialize<'de> for Field<T> {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        // `Option<T>` maps JSON null to None; serde only calls this at all when
        // the key is present, so None here means null and absence is supplied
        // by `Default` instead.
        Option::<T>::deserialize(deserializer).map(|value| match value {
            None => Self::Null,
            Some(value) => Self::Value(value),
        })
    }
}

/// `jsonb ->> 'k'` — the value of a key **as text**, whatever JSON type it had.
///
/// The split writer reads every one of a line's five fields this way
/// (`20260806094058:245-262`), and `->>` is not `as_str()`: it renders a JSON
/// number as its own spelling, a boolean as `true`/`false`, and yields SQL NULL
/// only for JSON null. So `{"amount": -15}` reaches the cloud's numeric cast as
/// the text `-15`, and a caller that has always sent numbers keeps working.
///
/// MEASURED against the reference cluster, 2026-08-08, one `->>` per shape:
/// `-15` → `-15`, `"-15.00"` → `-15.00`, `true` → `true`, `null` → NULL.
///
/// Absence is the caller's to distinguish: a key that is not in the object never
/// reaches this function, and `serde(default)` supplies [`serde_json::Value::Null`]
/// for it — which is what `->>` on a missing key returns too.
#[must_use]
pub fn as_text(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::Null => None,
        serde_json::Value::String(text) => Some(text.clone()),
        // `to_string()` on a number is its JSON spelling, which is what `->>`
        // produces; on an object or array it is the compact JSON document, which
        // is also what `->>` produces.
        other => Some(other.to_string()),
    }
}

/// `btrim(COALESCE(x, ''))` — the trimmed text, empty when there was none.
#[must_use]
pub fn trimmed_text(value: &serde_json::Value) -> String {
    as_text(value).map_or_else(String::new, |text| text.trim().to_owned())
}

/// `NULLIF(btrim(COALESCE(x, '')), '')` — the trimmed text, or nothing at all.
///
/// The shape the split writer uses for `id`, `memo` and `transfer_account_id`:
/// a field of spaces is a field the caller did not fill in.
#[must_use]
pub fn trimmed_or_none(value: &serde_json::Value) -> Option<String> {
    let text = trimmed_text(value);
    if text.is_empty() {
        None
    } else {
        Some(text)
    }
}

/// `NULLIF(x, '')` — the RPC's way of saying "an empty string is not a value".
///
/// Applied by the cloud to `id`, `transfer_account_id`, `category_id` and
/// `statement_sequence`, and **not** to `category` or `notes`, which are stored
/// verbatim including `''`. That asymmetry is real and is reproduced exactly;
/// it is why this is a named function rather than a blanket rule.
#[must_use]
pub fn null_if_empty(value: Option<&str>) -> Option<&str> {
    match value {
        Some("") | None => None,
        Some(text) => Some(text),
    }
}

/// Is this a real calendar date in `YYYY-MM-DD`?
///
/// The cloud casts `(p->>'date')::date`, so Postgres refuses `2024-13-45` and
/// `2023-02-29` for it. `schema.sql`'s CHECK is only a shape test
/// (`date LIKE '____-__-__'`), which would let both through. A ledger that
/// accepts 31 February is not a smaller problem than one that accepts a float,
/// so the verb closes it here.
///
/// This is a **local strengthening with a different name**: both engines refuse,
/// Postgres says `invalid input syntax for type date` and this says
/// `date_invalid`. Outcome parity holds; the message does not, and the
/// differential spec declares that per engine.
#[must_use]
pub fn is_calendar_date(text: &str) -> bool {
    let bytes = text.as_bytes();
    if bytes.len() != 10 || bytes.get(4) != Some(&b'-') || bytes.get(7) != Some(&b'-') {
        return false;
    }
    let digits_ok = [0, 1, 2, 3, 5, 6, 8, 9]
        .iter()
        .all(|index| bytes.get(*index).is_some_and(u8::is_ascii_digit));
    if !digits_ok {
        return false;
    }

    let number = |from: usize, to: usize| -> i32 {
        text.get(from..to)
            .and_then(|part| part.parse::<i32>().ok())
            .unwrap_or(-1)
    };
    let year = number(0, 4);
    let month = number(5, 7);
    let day = number(8, 10);
    if year < 1 || !(1..=12).contains(&month) || day < 1 {
        return false;
    }
    day <= days_in_month(year, month)
}

// The divisors are non-zero literals and every operand is a bounded i32 parsed
// from at most four digits, so none of this can overflow or divide by zero.
#[allow(clippy::arithmetic_side_effects)]
const fn days_in_month(year: i32, month: i32) -> i32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            let leap = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
            if leap {
                29
            } else {
                28
            }
        }
        _ => 0,
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::{
        as_text, is_calendar_date, null_if_empty, trimmed_or_none, trimmed_text, Field, Flag,
        Ordinal,
    };

    #[test]
    fn as_text_is_the_double_arrow_and_not_as_str() {
        use serde_json::json;
        // The three that matter to the split writer: a number arrives as its own
        // spelling, a string as itself, a JSON null as nothing.
        assert_eq!(as_text(&json!(-15)).as_deref(), Some("-15"));
        assert_eq!(as_text(&json!("-15.00")).as_deref(), Some("-15.00"));
        assert_eq!(as_text(&json!(null)), None);
        assert_eq!(as_text(&json!(true)).as_deref(), Some("true"));
        assert_eq!(as_text(&json!("")).as_deref(), Some(""));
    }

    #[test]
    fn trimming_matches_btrim_and_nullif() {
        use serde_json::json;
        assert_eq!(trimmed_text(&json!("  x  ")), "x");
        assert_eq!(trimmed_text(&json!(null)), "");
        assert_eq!(trimmed_text(&json!("   ")), "");
        assert_eq!(trimmed_or_none(&json!("   ")), None);
        assert_eq!(trimmed_or_none(&json!(null)), None);
        assert_eq!(trimmed_or_none(&json!(" x ")).as_deref(), Some("x"));
    }

    #[test]
    fn a_flag_accepts_exactly_what_postgres_accepts() {
        for text in ["t", "tr", "tru", "true", "TRUE", " true ", "y", "ye", "yes", "on", "1"] {
            assert_eq!(
                Flag::Text(text.into()).resolve(),
                Ok(true),
                "casting {text:?}"
            );
        }
        for text in [
            "f", "fa", "fal", "fals", "false", "FALSE", "n", "no", "of", "off", "0",
        ] {
            assert_eq!(
                Flag::Text(text.into()).resolve(),
                Ok(false),
                "casting {text:?}"
            );
        }
        assert_eq!(Flag::Bool(true).resolve(), Ok(true));
        assert_eq!(Flag::Bool(false).resolve(), Ok(false));
    }

    #[test]
    fn a_flag_refuses_exactly_what_postgres_refuses() {
        // "o" is a prefix of both `on` and `off`; Postgres refuses ambiguity
        // and so does this. "" is the sentinel case the whole update-verb
        // sentinel table turns on.
        for text in ["", "o", "2", "banana", "-1", "true false"] {
            let error = Flag::Text(text.into())
                .resolve()
                .expect_err("must refuse {text:?}");
            assert!(
                error.contains("invalid input syntax for type boolean"),
                "{text:?} -> {error}"
            );
        }
    }

    #[test]
    fn a_field_keeps_absent_and_null_apart() {
        #[derive(serde::Deserialize)]
        struct Patch {
            #[serde(default)]
            notes: Field<String>,
        }

        let absent: Patch = serde_json::from_str("{}").expect("absent");
        assert_eq!(absent.notes, Field::Absent);
        assert!(!absent.notes.is_present());

        let null: Patch = serde_json::from_str(r#"{"notes": null}"#).expect("null");
        assert_eq!(null.notes, Field::Null);
        assert!(null.notes.is_present(), "a JSON null IS a present key");
        assert_eq!(null.notes.value(), None);

        let empty: Patch = serde_json::from_str(r#"{"notes": ""}"#).expect("empty");
        assert_eq!(empty.notes, Field::Value(String::new()));
        assert!(empty.notes.is_present());
        assert_eq!(empty.notes.value().map(String::as_str), Some(""));
    }

    #[test]
    fn an_ordinal_arrives_as_a_number_a_string_or_nothing() {
        assert_eq!(Ordinal::Number(7).resolve(), Ok(Some(7)));
        assert_eq!(Ordinal::Text("7".into()).resolve(), Ok(Some(7)));
        assert_eq!(Ordinal::Text(String::new()).resolve(), Ok(None));
        assert!(Ordinal::Text("seven".into()).resolve().is_err());
    }

    #[test]
    fn null_if_empty_matches_the_rpcs_nullif() {
        assert_eq!(null_if_empty(Some("")), None);
        assert_eq!(null_if_empty(None), None);
        assert_eq!(null_if_empty(Some("x")), Some("x"));
    }

    #[test]
    fn calendar_dates_are_real_dates() {
        for good in ["2024-03-01", "2024-02-29", "2023-12-31", "2000-02-29"] {
            assert!(is_calendar_date(good), "{good}");
        }
        for bad in [
            "2024-13-01",
            "2024-00-01",
            "2024-02-30",
            "2023-02-29",
            "1900-02-29",
            "2024-3-01",
            "2024-03-1",
            "24-03-01",
            "2024/03/01",
            "",
            "2024-03-01T00:00:00Z",
            "0000-01-01",
        ] {
            assert!(!is_calendar_date(bad), "{bad}");
        }
    }
}
