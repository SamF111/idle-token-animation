# Idle Token Animation

![Foundry Version](https://img.shields.io/badge/Foundry-v13%20%7C%20v14-informational)
![Latest Release](https://img.shields.io/github/v/release/SamF111/idle-token-animation?label=release)
![Latest Downloads](https://img.shields.io/github/downloads/SamF111/idle-token-animation/latest/idle-token-animation.zip?label=latest%20downloads)

Idle Token Animation adds subtle ambient motion to living tokens in Foundry VTT.

Tokens with HP above 0 can gently bob, sway, and tilt while remaining in their true scene position. The effect is visual-only: it does not move TokenDocuments, change token coordinates, alter scene data, or affect attacks, ranges, targeting, walls, automation, or grid position.

The GM controls the global animation amount through world settings. Players do not configure the effect locally.

Actors can be excluded through their Prototype Token configuration. Individual placed tokens can also be excluded.

https://github.com/user-attachments/assets/f0cc10c3-2ccb-402b-8545-c2271b9797ae


## Features

* Subtle idle bob, sway, and tilt for living tokens
* HP greater than 0 eligibility filtering
* GM-only world settings
* Actor prototype opt-out
* Placed-token opt-out
* Hidden-token respect option
* Combat-token respect option
* Render-only client-side animation
* FX Bus token oscillation compatibility
* Scene-change and canvas-teardown cleanup

## How it works

Idle Token Animation separates eligibility from rendering.

The GM determines which tokens are eligible, then broadcasts a sync message to clients. Each client animates only the listed token render objects locally.

The animation writes only to the token render layer:

* `target.pivot.set(...)`
* `target.rotation = ...`

The module does not write animation changes back to the TokenDocument or Scene.

When animation stops, the original render state is restored.

## Safety guarantees

Idle Token Animation does not:

* Update TokenDocuments for animation
* Change token `x` or `y`
* Call `token.document.update(...)` for animation
* Call `canvas.scene.updateEmbeddedDocuments("Token", ...)` for animation
* Move token scene position
* Affect attacks
* Affect ranges
* Affect targeting
* Affect walls
* Affect automation
* Affect grid position
* Persist animation offsets into the world

## Settings

### Enable Idle Token Animation

Turns the module on or off.

Default: enabled.

### Idle Amount

Controls the global animation strength.

* `0` = off
* `1` = subtle
* `2+` = exaggerated

Default: `1.0`.

### Do Not Animate Hidden Tokens

Excludes hidden tokens from animation.

Default: enabled.

### Do Not Animate Tokens In Combat

Excludes tokens currently in combat.

Default: disabled.

### HP Detection Mode

Controls how the module resolves actor HP.

Default: automatic.

### Custom HP Path

Actor system path used when HP Detection Mode is set to Custom.

Example:

```text
system.attributes.hp.value
```

### Default Actor Opt-Out

Treats actors as opted out unless explicitly enabled later.

Default: disabled.

## Opt-out

Actor prototype token opt-out:

```js
await actor.update({
  "prototypeToken.flags.idle-token-animation.disabled": true
});
```

Placed-token opt-out:

```js
await token.document.setFlag("idle-token-animation", "disabled", true);
```

Clear placed-token opt-out:

```js
await token.document.unsetFlag("idle-token-animation", "disabled");
```

Any disable flag wins.

## FX Bus compatibility

[FX Bus](https://github.com/SamF111/fxbus/) token oscillation takes priority over Idle Token Animation.

When FX Bus starts token oscillation, Idle Token Animation stops animating that token. When FX Bus token oscillation stops, Idle Token Animation requests a fresh eligibility sync.

This prevents two modules from trying to animate the same token render object at the same time.

## Optional donation

Idle Token Animation is free and open source.

This project does not accept donations. If you would like to make a donation instead, please consider UNITED24, Ukraine’s official fundraising platform:

[Donate through UNITED24](https://u24.gov.ua/)

Idle Token Animation receives no money from this link.
