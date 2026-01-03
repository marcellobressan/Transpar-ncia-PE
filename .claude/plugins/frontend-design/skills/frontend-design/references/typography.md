# Typography Inspiration

Distinctive font pairings that avoid generic choices:

## Display + Body Combinations

### Editorial/Magazine
- **Display**: Playfair Display, Cormorant Garamond, Libre Baskerville
- **Body**: Source Serif Pro, Lora, Merriweather

### Modern/Tech
- **Display**: Clash Display, Cabinet Grotesk, General Sans
- **Body**: Satoshi, Plus Jakarta Sans, DM Sans

### Brutalist/Raw
- **Display**: Monument Extended, Bebas Neue, Oswald
- **Body**: IBM Plex Mono, JetBrains Mono, Fira Code

### Luxury/Refined
- **Display**: Canela, Freight Display, Didot
- **Body**: Freight Text, Garamond Premier, Minion Pro

### Playful/Friendly
- **Display**: Fraunces, Lora, Zilla Slab
- **Body**: Nunito, Quicksand, Poppins

### Retro/Vintage
- **Display**: Reckless Neue, Cooper Black, ITC Avant Garde
- **Body**: Courier Prime, American Typewriter, Bookman

## Free Google Fonts Alternatives

### High Impact
- Syne (variable, geometric, bold)
- Space Grotesk (tech, but use sparingly)
- Outfit (modern, versatile)
- Instrument Sans (refined, professional)

### Elegant Serifs
- Cormorant (delicate, editorial)
- Spectral (reading, classic)
- Fraunces (quirky, warm)
- Bodoni Moda (high contrast, fashion)

### Unique Display
- Unbounded (rounded, futuristic)
- Big Shoulders Display (condensed, impact)
- Rethink Sans (geometric, modern)
- Bricolage Grotesque (quirky, character)

## Implementation

```css
/* Import from Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');

:root {
  --font-display: 'Syne', sans-serif;
  --font-body: 'DM Sans', sans-serif;
}

h1, h2, h3 {
  font-family: var(--font-display);
  font-weight: 700;
  letter-spacing: -0.02em;
}

body {
  font-family: var(--font-body);
  font-weight: 400;
  line-height: 1.6;
}
```

## Tailwind Integration

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
    },
  },
}
```

```html
<h1 class="font-display text-5xl font-bold tracking-tight">
  Bold Headline
</h1>
<p class="font-body text-lg leading-relaxed">
  Body text with comfortable reading.
</p>
```
