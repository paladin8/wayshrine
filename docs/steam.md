# Steam release setup

The desktop bundles include the Steamworks binding for Windows x64 and both Mac architectures. Set the GitHub Actions repository variable `WAYSHRINE_STEAM_APP_ID` to Wayshrine’s App ID for release builds, or set the same environment variable before running the local desktop packager. The build rejects a mismatched App ID at launch. The app can also discover the App ID supplied by the Steam launcher. Launch from the Steam library to test Steam-managed sync.

## Steam Cloud

In the app’s **Steam Cloud** settings, set a byte quota (for example, `67108864`) and a file quota of at least one. Configure the following **Auto-Cloud Root Path**, replacing `<AppId>` with the actual numeric ID.

| Field | Value |
| --- | --- |
| Root | `WinAppDataRoaming` |
| Subdirectory | `Wayshrine/steam/<AppId>/{64BitSteamID}` |
| Pattern | `journeys.json` |
| OS Restriction | Cross-Platform |
| Recursive | Off |

Add a **Root Override** for macOS with original root `WinAppDataRoaming`, new root `MacAppSupport`, an empty Add/Replace Path, and Replace Path unchecked. The same file then syncs between `%APPDATA%/Wayshrine/steam/<AppId>/<SteamID64>/journeys.json` on Windows and `~/Library/Application Support/Wayshrine/steam/<AppId>/<SteamID64>/journeys.json` on macOS. Save and publish the configuration. Leave Dynamic Cloud Sync disabled while the game only reads the synced file at launch. [Valve’s Steam Cloud setup](https://partner.steamgames.com/doc/features/cloud)

The file holds all journeys for that Steam account, including progress, last-played slot and position. Preferences stay on the device. If there is no downloaded save, the first Steam account to open the desktop app on that computer can import its existing standalone desktop saves. The standalone copies stay available outside Steam. Existing Steam saves take precedence, and subsequent Steam accounts have their own save directory.

## Achievements

Create one community achievement for each entry in [the achievement catalog](../desktop/steam-achievements.json). Use its key as the Steam **API Name** and its values for the display name and description. Add locked and unlocked icons, then save and publish the definitions. The game reports achievement milestones during play and checks previous progress when a journey is opened. [Valve’s achievement setup](https://partner.steamgames.com/doc/features/achievements)

## Verify on a Steam beta branch

1. Upload both builds and install the beta from the Steam library on Windows. Start a saved journey, restore a shrine, collect a rubbing, and quit through Settings. Check that Steam reports the Cloud status as up to date and that the achievements appear in the library.
2. Sign in to the same account on a Mac with the same beta branch. Launch through Steam and check that the journey, restoration, rubbing, and position carry over. Make another change on the Mac, quit, and check it on Windows.
3. Launch with a different Steam account that can access the beta. Confirm it gets its own journeys. Check that going offline in the signed-in Steam client still allows local saving and that Steam syncs on reconnection.
4. If a file is missing, follow Valve’s `testappcloudpaths <AppId>` procedure and check Steam’s Cloud log. Verify the exact achievement API names and publish status before retesting. [Valve’s testing instructions](https://partner.steamgames.com/doc/features/cloud#testing)
