# Idle Token Animation

![Foundry Version](https://img.shields.io/badge/Foundry-v13%20%7C%20v14-informational)
![Latest Release](https://img.shields.io/github/v/release/SamF111/idle-token-animation?label=release)
![Latest Downloads](https://img.shields.io/github/downloads/SamF111/idle-token-animation/latest/idle-token-animation.zip?label=latest%20downloads)

This is a really silly, entirely unnecessary, but fun module called Idle Token Animation that adds subtle ambient motion to living tokens in Foundry VTT.

Tokens can gently bob, sway, and tilt while remaining in their true scene position. The effect is visual-only: it does not move TokenDocuments, change token coordinates, alter scene data, or affect attacks, ranges, targeting, walls, automation, or grid position.

The GM controls global animation behaviour through world settings. Players do not configure the effect locally.

Actors can be excluded through their Prototype Token configuration. Individual placed tokens can also be excluded or given their own motion settings.

Supported conditions can automatically alter the animation. Petrified or paralysed tokens become still, unconscious tokens move more subtly, stunned tokens may twitch, and frightened tokens tremble.

Condition-sensitive animation currently supports:

* D&D 5e
* Pathfinder Second Edition

Unsupported systems continue using normal idle animation.

https://github.com/user-attachments/assets/f0cc10c3-2ccb-402b-8545-c2271b9797ae

## Features

* Subtle idle bob, sway, and tilt
* Condition-sensitive animation
* D&D 5e condition support
* Pathfinder Second Edition condition support
* HP greater than 0 eligibility filtering
* Optional HP filtering
* GM-only world settings
* Global motion configuration
* Actor prototype opt-out
* Placed-token opt-out
* Per-token motion overrides
* Hidden-token respect option
* Combat-token respect option
* Render-only client-side animation
* GM-authoritative eligibility and condition resolution
* [FX Bus](https://github.com/SamF111/fxbus/) token oscillation compatibility
* Scene-change and canvas-teardown cleanup

## Condition responses

When condition-sensitive animation is enabled, recognised conditions are translated into neutral visual behaviours.

| Condition             | Animation behaviour                     |
| --------------------- | --------------------------------------- |
| Petrified             | Animation stops                         |
| Paralysed / Paralyzed | Animation stops                         |
| Unconscious           | Slow, subdued motion                    |
| Stunned               | Reduced motion with occasional twitches |
| Frightened            | Normal motion with a subtle tremor      |

Conditions are resolved by the GM and included in the normal animation synchronisation message.

D&D 5e uses its active status data.

Pathfinder Second Edition uses the system's prepared actor condition collection, including active stored and generated conditions.

If multiple recognised conditions are active, stronger movement restrictions take priority.

## How it works

Idle Token Animation separates eligibility and condition resolution from rendering.

The GM determines:

* whether the module is enabled
* which tokens are eligible
* each token's effective motion settings
* whether recognised conditions modify the motion

The GM then broadcasts a synchronisation message to connected clients.

Each client animates only the listed token render objects locally.

The animation writes only to the token render layer:

* `target.pivot.set(...)`
* `target.rotation = ...`

The module does not write animation changes back to the TokenDocument or Scene.

When animation stops, the original pivot and rotation are restored.

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
* Change token scale
* Change token visibility
* Change token alpha
* Persist animation offsets into the world

Document flags are written only when the GM deliberately changes actor or placed-token configuration.

## Settings

### Enable Idle Token Animation

Turns the module on or off.

Default: enabled.

### Enable Condition-Based Animation

Allows recognised conditions to modify token animation.

Unsupported systems and unrecognised conditions continue using normal idle motion.

Default: enabled.

### Motion Settings

Opens the compact motion configuration window.

#### Motion Strength

Controls the overall animation strength.

* `0` = off
* `1` = configured values
* `2+` = exaggerated

Default: `1.0`.

#### Motion Speed

Controls the idle animation frequency in cycles per second.

Default: `0.5`.

#### Irregularity

Adds subtle organic variation to the base idle movement.

Default: `0.01`.

#### Vertical Bob

Controls vertical movement in pixels before Motion Strength is applied.

Default: `2`.

#### Horizontal Sway

Controls horizontal movement in pixels before Motion Strength is applied.

Default: `2`.

#### Tilt Angle

Controls visual rotation in degrees before Motion Strength is applied.

Default: `0`.

#### Desynchronise Token Motion

Gives tokens different phases, amplitudes, frequencies, and gradual speed variation so groups do not move in unison.

Default: enabled.

### Do Not Animate Hidden Tokens

Excludes hidden tokens from animation.

Default: enabled.

### Do Not Animate Tokens In Combat

Excludes tokens currently in combat.

Default: disabled.

### Filter 0 HP Tokens

Requires actor HP to resolve above 0 before the token can animate.

Disable this setting to ignore HP during eligibility checks.

Default: enabled.

### HP Detection Mode

Controls how the module resolves actor HP.

Choices:

* Automatic
* Custom Path

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

## Token configuration

Placed tokens receive an Idle Animation tab in Token Configuration.

The tab allows the GM to:

* disable idle animation for the placed token
* override global motion settings
* configure the token's motion strength, speed, bob, sway, tilt, irregularity, and phase behaviour

Placed-token motion overrides are applied before condition responses.

## Opt-out

Actor Prototype Token opt-out:

```js
await actor.update({
  "prototypeToken.flags.idle-token-animation.disabled": true
});
```

Placed-token opt-out:

```js
await token.document.setFlag(
  "idle-token-animation",
  "disabled",
  true
);
```

Clear placed-token opt-out:

```js
await token.document.unsetFlag(
  "idle-token-animation",
  "disabled"
);
```

Any disable flag wins.

## FX Bus compatibility

[FX Bus](https://github.com/SamF111/fxbus/) token oscillation takes priority over Idle Token Animation.

When FX Bus starts token oscillation, Idle Token Animation stops animating that token and restores its captured render baseline.

When FX Bus token oscillation stops, Idle Token Animation requests a fresh GM synchronisation and resumes the token's current eligible animation state.

This prevents two modules from trying to animate the same token render object simultaneously.

## System compatibility

### D&D 5e

Recognised conditions are read from actor statuses and Active Effects.

### Pathfinder Second Edition

Recognised conditions are read from PF2e's prepared `actor.conditions` collection.

PF2e condition, effect, and affliction Item changes trigger an automatic animation resynchronisation.

### Other systems

Other systems retain normal idle animation.

Condition-sensitive behaviour is disabled for unsupported systems without affecting the rest of the module.

## Optional donation

Idle Token Animation is free and open source.

This project does not accept donations. If you would like to make a donation instead, please consider UNITED24, Ukraine's official fundraising platform:

[Donate through UNITED24](https://u24.gov.ua/)

Idle Token Animation receives no money from this link.
