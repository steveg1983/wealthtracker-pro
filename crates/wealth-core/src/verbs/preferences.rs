//! `read_preferences` and `write_preferences` — the settings that belong to the
//! PERSON rather than to the window, kept in the ledger file itself.
//!
//! # What they are a port OF (PHASE3-PLAN D-2, the fifth family)
//!
//! `supabasePreferencesTransport()` — two PostgREST calls in
//! `services/preferencesService.ts`, and no Postgres function anywhere near
//! them:
//!
//! ```text
//! read   .from('user_preferences').select('prefs').eq('user_id', …).maybeSingle()
//! write  .from('user_preferences').upsert({ user_id, prefs }, { onConflict: 'user_id' })
//! ```
//!
//! So the oracle is a TypeScript writer plus `schema.sql`'s constraints, exactly
//! as it is for the account, category, planning and dismissal families, and
//! `lib/verb-postgres.mjs` runs those two calls through `psql` transcribed key
//! for key. Everything in the argument at the head of [`crate::verbs`] applies
//! here unchanged; what follows is only what is different about this table.
//!
//! | | the cloud's direct write | the verb |
//! | --- | --- | --- |
//! | the row's `id` | `uuid` with `DEFAULT gen_random_uuid()` | minted here — B-5's argument, one table along: `schema.sql`'s `user_preferences.id` is `TEXT PRIMARY KEY` with **no** default, because a TEXT id column cannot be given one |
//! | `updated_at` on a replace | `update_user_preferences_updated_at`, a `BEFORE UPDATE` trigger | written by the verb: `schema.sql` ports four of the cloud's eleven `updated_at` triggers and this table is not one of them (see its note at the trigger block) |
//! | the audit log | nothing | nothing either — the dismissal pair's argument, applied again: divergence 10 turns on money living in four columns, and a preference holds no figure in either engine |
//! | a document that is not an object | `jsonb_typeof(prefs) = 'object'` refuses it | `json_type(prefs) = 'object'` refuses it — the same rule, spelled for the engine that has no `jsonb` |
//! | a document over 256 KiB | `length(prefs::text) <= 262144` refuses it | the same number over the same measurement |
//! | no row for this owner | `maybeSingle()` answers `data = null`, and the transport answers `null` | `preferences: null`, which is the same sentence: *this store holds none* |
//!
//! # THE DOCUMENT IS OPAQUE, AND THAT IS THE WHOLE DESIGN
//!
//! Nothing in this module reads a key of it. It does not know that a
//! preferences document has a `version` and a `values`, it does not know that
//! `dashboardKeyAccounts` holds account ids, and it never will. A preference is
//! a statement in the APP's vocabulary — `services/preferences/document.ts` owns
//! the shape, `PREFERENCE_KEYS_HOLDING_IDS` owns which of them name rows, and
//! `remapBackupIds` is what follows those ids across a restore. A crate that
//! learned any of it would be a second registry of preference keys, going stale
//! the first time a screen remembered something new.
//!
//! What this module owns is smaller and is the part a file has to own: that the
//! document is stored WHOLE, that it comes back byte for byte, that it belongs
//! to exactly one owner, and that replacing it replaces it.
//!
//! # IT IS ONE ROW PER OWNER, AND THE WRITE IS AN UPSERT
//!
//! `UNIQUE (user_id)` is the whole storage model, and the write is a single
//! `INSERT … ON CONFLICT(user_id) DO UPDATE` — which is what
//! `upsert(…, { onConflict: 'user_id' })` compiles to on the other engine, so
//! the two are the same statement rather than the same outcome by two routes.
//!
//! `created_at` therefore survives a replace and `updated_at` moves, on both
//! engines, and a caller cannot accidentally end up with two documents.
//!
//! # WHY THE WRITE OPENS A TRANSACTION FOR ONE STATEMENT
//!
//! It does not, quite: it makes the write and then READS THE ROW BACK, because
//! this crate's rule is that a write answers with the row as STORED rather than
//! with the row as sent (`localDataPort.ts`: *"Every write below answers with
//! the row as stored"*). Two statements that must describe one moment are one
//! `IMMEDIATE` transaction, for [`super::seed_categories`]'s reason.
//!
//! The read-back is not ceremony. It is what makes the round trip provable from
//! outside: a caller can compare what it sent against what the file now holds
//! without a second crossing, and the differential harness can compare two
//! engines' STORED documents rather than two engines' echoes.
//!
//! # No guard, measured
//!
//! `user_preferences` has no triggers at all — not an `updated_at` stamp, not a
//! protection — so there is nothing for `_rpc_guard` to stand down.
//! `tests/preferences.rs` asserts the guard table empty across a write, which is
//! the same assertion every other family makes rather than a paragraph.
//!
//! # What is deliberately absent: a DELETE
//!
//! There is no `clear_preferences`. The cloud has a delete POLICY and no caller:
//! `PreferencesService.removeItem` takes a key OUT OF THE DOCUMENT and writes
//! the document back, so the row's whole life is one insert and then replaces.
//! A verb for an operation no edition performs would be a door with nothing
//! behind it — and the one thing that really does remove the row is
//! `ON DELETE CASCADE` from `users`, which is the file being deleted with its
//! owner.

use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::db;
use crate::error::{CoreError, CoreResult};

/// `read_preferences` — one argument, because a document has one question.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ReadPreferences {
    /// Whose settings. Absent is refused rather than guessed — see below.
    #[serde(default)]
    pub user_id: Option<String>,
}

/// `write_preferences` — an owner and the whole document.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct WritePreferences {
    /// Whose settings.
    #[serde(default)]
    pub user_id: Option<String>,
    /// The document, verbatim and unexamined. See the module header: this crate
    /// does not know what a preference is, and a `Value` is how it says so.
    ///
    /// Required rather than defaulted: an absent document and an empty one are
    /// different instructions, and only one of them was asked for. The empty
    /// one is `{}` and is perfectly legal — it is what a person who has turned
    /// everything back to its default has.
    pub preferences: Value,
}

/// What a file holds for one owner.
///
/// Both verbs answer with this, and that is deliberate: a write's answer is the
/// document READ BACK, so the two are the same question and there is no second
/// shape for a caller to learn.
#[derive(Debug, Serialize)]
pub struct StoredPreferences {
    /// The document as the file holds it, or `null` when the file holds none
    /// for this owner. `null` and `{}` are different answers — *"nothing has
    /// ever been saved here"* against *"everything is at its default"* — and
    /// `PreferencesService.attach` branches on exactly that difference to decide
    /// whether to lift this machine's settings into the store.
    pub preferences: Option<Value>,
}

/// What `read_preferences` hands back.
#[derive(Debug, Serialize)]
pub struct ReadPreferencesResult {
    /// See [`StoredPreferences`].
    pub answer: StoredPreferences,
}

/// What `write_preferences` hands back.
#[derive(Debug, Serialize)]
pub struct WritePreferencesResult {
    /// The document as the file now holds it — never the one that was sent.
    pub answer: StoredPreferences,
}

/// Read one owner's settings.
///
/// # Errors
/// [`CoreError::Refused`] with `owner_unknown` when no owner was named, for
/// [`super::collect_backup`]'s reason: a document read against an unresolved
/// identity is somebody else's settings, or nobody's, and the caller cannot tell
/// which. [`CoreError::Storage`] for a fault.
#[allow(clippy::needless_pass_by_value)]
pub fn read_preferences(
    connection: &Connection,
    command: ReadPreferences,
) -> CoreResult<ReadPreferencesResult> {
    let Some(owner) = command.user_id.as_deref() else {
        return Err(owner_unknown());
    };

    Ok(ReadPreferencesResult {
        answer: StoredPreferences {
            preferences: stored(connection, owner)?,
        },
    })
}

/// Replace one owner's settings with the document supplied.
///
/// REPLACES rather than merges, exactly as the cloud's upsert does and for the
/// reason the service gives where it calls it: the document is read as a SET,
/// written whole, and a key the caller left out is a key the person removed —
/// possibly on another machine. A merge here would resurrect it on every write.
///
/// # Errors
/// [`CoreError::Refused`] with `owner_unknown` when no owner was named, or
/// `constraint_violated` when the file refuses the document — it is not a JSON
/// object, it is larger than the 256 KiB ceiling, or the owner named has no
/// `users` row. All three are the FILE's rules and all three are the cloud's
/// too, which is why none of them is re-stated here as a refusal of its own.
/// [`CoreError::Storage`] for a fault.
#[allow(clippy::needless_pass_by_value)]
pub fn write_preferences(
    connection: &mut Connection,
    command: WritePreferences,
) -> CoreResult<WritePreferencesResult> {
    let Some(owner) = command.user_id.as_deref() else {
        return Err(owner_unknown());
    };

    let document = serde_json::to_string(&command.preferences)
        .map_err(|error| CoreError::InvalidCommand(format!("preferences: {error}")))?;

    // IMMEDIATE: the write and the read-back describe one moment. See the header.
    let write = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now(&write)?;

    // The cloud's `upsert(…, { onConflict: 'user_id' })`, in SQL. `excluded` is
    // the row that was refused entry, so the update takes the new document and
    // the new stamp and leaves `id` and `created_at` exactly as they were —
    // which is what an upsert means on the other engine as well.
    write.execute(
        "INSERT INTO user_preferences (id, user_id, prefs, created_at, updated_at)
              VALUES (?1, ?2, ?3, ?4, ?4)
         ON CONFLICT(user_id) DO UPDATE
            SET prefs = excluded.prefs, updated_at = excluded.updated_at",
        params![super::minted_uuid(None), owner, document, now],
    )?;

    let preferences = stored(&write, owner)?;
    write.commit()?;

    Ok(WritePreferencesResult {
        answer: StoredPreferences { preferences },
    })
}

/// The refusal both verbs give for a caller who could not say whose file it is.
fn owner_unknown() -> CoreError {
    CoreError::refuse(
        "owner_unknown",
        "could not establish whose settings to read or write",
    )
}

/// One owner's stored document, or `None` when there is no row.
///
/// The one read in this module, shared by both verbs so that a write's answer
/// and a read's answer cannot come out of two different SELECTs.
fn stored(connection: &Connection, owner: &str) -> CoreResult<Option<Value>> {
    // EXPLAIN QUERY PLAN (measured against schema.sql):
    //   SEARCH user_preferences USING INDEX sqlite_autoindex_user_preferences_2 (user_id=?)
    // The index is `UNIQUE (user_id)`'s own, which is also the constraint that
    // makes "one row per owner" true — so there is exactly one access path here
    // and no second index to keep.
    let text: Option<String> = connection
        .query_row(
            "SELECT prefs FROM user_preferences WHERE user_id = ?1",
            params![owner],
            |record| record.get(0),
        )
        .optional()?;

    let Some(text) = text else { return Ok(None) };

    // A FAULT rather than a fallback, and it differs from `crate::backup`'s
    // treatment of a JSON column on purpose. There the rule is *"a blob this
    // file cannot parse travels as its own text instead of failing the export"*,
    // because a backup that refuses to be taken is worse than one carrying
    // something odd. Here the column carries `CHECK (json_valid(prefs))`, so
    // unparseable text cannot have been written by this program at all — and the
    // alternative answers are both silent losses: a JSON string where an object
    // is expected reads as *"this person has no settings"*.
    serde_json::from_str(&text).map(Some).map_err(|error| {
        CoreError::Storage(rusqlite::Error::FromSqlConversionFailure(
            0,
            rusqlite::types::Type::Text,
            Box::new(error),
        ))
    })
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::{ReadPreferences, WritePreferences};

    #[test]
    fn the_read_refuses_a_key_it_does_not_know() {
        let error = serde_json::from_str::<ReadPreferences>(r#"{"userId":"x"}"#)
            .expect_err("an unknown key must refuse");
        assert!(error.to_string().contains("userId"), "{error}");
    }

    #[test]
    fn an_absent_owner_parses_and_is_refused_by_the_verb_rather_than_by_serde() {
        // `owner_unknown` is a sentence a person reads. A serde error would
        // arrive as `invalid_command` and say "missing field `user_id`".
        let command = serde_json::from_str::<ReadPreferences>("{}").expect("an empty object parses");
        assert!(command.user_id.is_none());
    }

    #[test]
    fn a_write_with_no_document_is_refused_at_the_boundary() {
        // An absent document and an empty one are different instructions. The
        // empty one is legal and is what a person with everything at its default
        // has; the absent one is a caller that did not say.
        let error = serde_json::from_str::<WritePreferences>(r#"{"user_id":"u"}"#)
            .expect_err("a write must name its document");
        assert!(error.to_string().contains("preferences"), "{error}");
    }

    #[test]
    fn an_empty_document_is_a_document() {
        let command = serde_json::from_str::<WritePreferences>(
            r#"{"user_id":"u","preferences":{"version":1,"values":{}}}"#,
        )
        .expect("an empty values map parses");
        assert!(command.preferences.is_object());
    }
}
