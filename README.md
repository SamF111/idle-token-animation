# Idle Token Animation

Idle Token Animation adds subtle ambient motion to living tokens in Foundry VTT.

Tokens with HP above 0 can gently bob, sway, and tilt while remaining in their true scene position. The module does not move TokenDocuments, does not change token coordinates, and does not affect attacks, ranges, targeting, walls, automation, or grid position.

The GM controls the global animation amount through world settings. Players do not configure the effect locally.

Actors can be excluded through their Prototype Token configuration, and individual placed tokens can also be excluded.

## Features

- Subtle idle bob, sway, and tilt for living tokens
- HP greater than 0 eligibility filtering
- GM-only world settings
- Actor prototype opt-out
- Placed-token opt-out
- Render-only client-side animation
- FX Bus token oscillation compatibility
- Scene and canvas cleanup

## Safety guarantees

Idle Token Animation does not:

- Update TokenDocuments
- Change token `x` or `y`
- Call `token.document.update(...)` for animation
- Call `canvas.scene.updateEmbeddedDocuments("Token", ...)` for animation
- Move token scene position
- Affect attacks
- Affect ranges
- Affect targeting
- Affect walls
- Affect automation
- Affect grid position

The module writes only to token render-layer pivot and rotation, then restores the original render state when animation stops.

## Settings

### Enable Idle Token Animation

Turns the module on or off.

Default: enabled.

### Idle Amount

Controls the global animation strength.

- `0` = off
- `1` = subtle
- `2+` = exaggerated

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

FX Bus token oscillation takes priority over Idle Token Animation.

When FX Bus starts token oscillation, Idle Token Animation stops animating that token. When FX Bus token oscillation stops, Idle Token Animation requests a fresh eligibility sync.

## Version

Initial development target: `0.1.0`.
