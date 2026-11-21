# Chrome Web Store — Interpretab

Last Updated: 2026-11-12

## Store listing

Name: Interpretab. Default language: English.
Copy and category: [store/listing.md](store/listing.md).
Single purpose: Translate tab and microphone audio in real time.

The controls now open in a separate browser tab. Click the extension icon on
the page to translate, then choose languages and press Start in the control page.
Clicking the icon on the same source page returns to its existing controls.
Closing the controls leaves translation running; Stop ends it.

## Graphics and assets

Existing assets: `store/` and `icons/`.
Screenshots showing the side panel need refreshing before the next publication.

## Permissions justification

Full review copy: [store/justifications.md](store/justifications.md).

| Permission | Purpose |
| --- | --- |
| tabCapture | Capture audio from the source page selected by the user. |
| offscreen | Keep audio translation running after the controls close. |
| storage | Save settings and restore the current translation state. |
| activeTab | Access the source page when the user clicks the icon. |
| scripting | Display subtitles and provide the optional translated Meet microphone. |
| https://generativelanguage.googleapis.com/* | Connect to Google's translation service using the user's key. |
| http://127.0.0.1/* (optional) | Send subtitles to the user's local OBS relay when enabled. |

The sidePanel permission has been removed.

## Privacy and data use

See [PRIVACY.md](PRIVACY.md) and its published source [docs/PRIVACY.md](docs/PRIVACY.md).
This UI change introduces no new transmission or collection of user data.

## Distribution and developer information

Existing listing and publication information remain in `store/listing.md`.
No store submission was performed for this change.

## Version history

| Version | Date | Changes | Status |
| --- | --- | --- | --- |
| Unreleased (working tree based on 1.0.4) | 2026-11-12 | Move all translation controls to a separate tab; retain the source page association; remove sidePanel permission. | Draft |

## Review notes

Older guide screenshots still depict the side panel and need refreshing before release.
