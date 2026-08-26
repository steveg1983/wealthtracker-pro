#!/usr/bin/env bash
#
# Build the iOS shell and upload it to TestFlight, without Xcode's GUI.
#
# WHY THIS EXISTS. On 26 Aug 2026 a headless `xcodebuild -exportArchive`
# failed twice over: first "App Store Connect access for VT6W829WRX is
# required", then — more revealingly — 
#
#     Provisioning profile "iOS Team Store Provisioning Profile:
#     com.wealthtracker.mobile" doesn't include the
#     com.apple.developer.associated-domains entitlement.
#
# Adding a capability in Xcode regenerates the DEVELOPMENT profile; the
# DISTRIBUTION profile is a separate object and does not follow. Regenerating
# it needs App Store Connect access, which a shell does not have — so the
# upload had to go through Xcode's Organizer, which holds the session.
#
# An App Store Connect API key IS that access. With the three
# -authentication* flags below, `-allowProvisioningUpdates` can regenerate the
# distribution profile itself, and the upload needs no GUI and no human.
#
# Usage:  scripts/ios-release.sh [build-number]
#         (build number defaults to the CURRENT_PROJECT_VERSION already set)
#
# Needs, in ~/Documents/WealthTracker-signing (or ASC_KEY_DIR):
#   AuthKey_<KEYID>.p8   downloadable from Apple exactly once — back it up
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IOS_DIR="$REPO_ROOT/apps/mobile/ios/App"
KEY_DIR="${ASC_KEY_DIR:-$HOME/Documents/WealthTracker-signing}"
KEY_ID="${ASC_KEY_ID:-K3X6D83JFR}"
ISSUER_ID="${ASC_ISSUER_ID:-5eefcc4c-7800-4c5f-b6ac-3ffb9c88655a}"
KEY_PATH="$KEY_DIR/AuthKey_${KEY_ID}.p8"
ARCHIVE="${TMPDIR:-/tmp}/wt-ios-$(date +%s).xcarchive"

if [ ! -f "$KEY_PATH" ]; then
  echo "No App Store Connect key at $KEY_PATH" >&2
  echo "Apple allows the .p8 to be downloaded ONCE; if it is lost, revoke the" >&2
  echo "key in App Store Connect and generate a new one." >&2
  exit 1
fi

# A build number already on App Store Connect is rejected, and the rejection
# arrives after the upload rather than before it — so it is worth setting
# deliberately rather than discovering.
if [ "${1:-}" != "" ]; then
  echo "==> Setting build number to $1"
  /usr/bin/sed -i '' "s/CURRENT_PROJECT_VERSION = [0-9][0-9]*;/CURRENT_PROJECT_VERSION = $1;/g" \
    "$IOS_DIR/App.xcodeproj/project.pbxproj"
fi

echo "==> Syncing Capacitor (config and entitlements)"
npm --prefix "$REPO_ROOT/apps/mobile" exec cap sync ios

echo "==> Archiving"
xcodebuild archive \
  -project "$IOS_DIR/App.xcodeproj" \
  -scheme App \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$KEY_PATH" \
  -authenticationKeyID "$KEY_ID" \
  -authenticationKeyIssuerID "$ISSUER_ID" \
  DEVELOPMENT_TEAM=VT6W829WRX

# Prove the entitlement survived into the SIGNED BINARY rather than trusting
# the project file. This is the whole point of the build, and it is cheap.
APP="$ARCHIVE/Products/Applications/App.app"
if ! codesign -d --entitlements :- "$APP" 2>/dev/null | grep -q "webcredentials:"; then
  echo "The archive does not carry the associated-domains entitlement — refusing to upload." >&2
  exit 1
fi
echo "==> Entitlement present: $(codesign -d --entitlements :- "$APP" 2>/dev/null | grep -o 'webcredentials:[^<]*')"

EXPORT_PLIST="${TMPDIR:-/tmp}/wt-export-options.plist"
cat > "$EXPORT_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key><string>app-store-connect</string>
	<key>destination</key><string>upload</string>
	<key>teamID</key><string>VT6W829WRX</string>
	<key>signingStyle</key><string>automatic</string>
	<key>uploadSymbols</key><true/>
	<!-- Never true: the build number is chosen above, deliberately. Letting
	     Xcode renumber invites a collision with something already uploaded. -->
	<key>manageAppVersionAndBuildNumber</key><false/>
</dict>
</plist>
PLIST

echo "==> Exporting and uploading to App Store Connect"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportOptionsPlist "$EXPORT_PLIST" \
  -exportPath "${TMPDIR:-/tmp}/wt-ios-export" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$KEY_PATH" \
  -authenticationKeyID "$KEY_ID" \
  -authenticationKeyIssuerID "$ISSUER_ID"

echo "==> Uploaded. It appears in TestFlight once Apple finishes processing."
