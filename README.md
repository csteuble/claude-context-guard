# context-guard-box

The companion of Chris's context guard mod (the `main` branch of this repo). It closes the context guard's "Auto compact will begin in 1 minute" box by itself when the minute is up. A question box runs through every mod's hooks but the one that asked, so the context guard cannot close its own box and this second plugin does.

It lives on this branch (`box`) because a plugin folder may not hold another plugin's `plugin.json`, and the context guard is the root of `main`. The marketplace file on `main` lists it with a `github` source and `"ref": "box"`. The vault source copy is `Work\Vault & Memory\Context Guard Box Mod\`; `claude plugin test .` runs its 4 tests.
