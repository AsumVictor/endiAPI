# Email Template Cross-Client Compatibility Guide

## The Problem

Email clients (Gmail, Outlook, Apple Mail, iOS Mail, etc.) have **very limited CSS support** and render emails differently. Your template may look great in one client but broken in another.

## Critical Rules for Email Templates

### 1. **Use Inline CSS** (Not `<style>` tags)

**❌ BAD:**
```html
<style>
  .button { color: red; }
</style>
<div class="button">Click</div>
```

**✅ GOOD:**
```html
<div style="color: red;">Click</div>
```

**Why?** Many email clients (especially Outlook, Gmail mobile) strip `<style>` tags.

### 2. **Use Table-Based Layouts**

**❌ BAD:**
```html
<div style="display: flex;">...</div>
```

**✅ GOOD:**
```html
<table>
  <tr>
    <td>Content</td>
  </tr>
</table>
```

**Why?** Flexbox/Grid are not supported. Tables are the most reliable.

### 3. **Use Inline Styles + Fallback `<style>`**

Best practice:
- **Inline styles** for critical styling (required)
- **`<style>` tag** in `<head>` for media queries and overrides (optional fallback)

### 4. **Avoid These CSS Features**

- ❌ Flexbox/Grid (`display: flex`, `display: grid`)
- ❌ Modern selectors (attribute selectors, `:before`, `:after`)
- ❌ `position: absolute/fixed`
- ❌ `max-width` (use `width` in tables)
- ❌ CSS animations
- ❌ JavaScript (all email clients strip it)
- ❌ External stylesheets (`<link>`)
- ❌ Font icons (use images)
- ⚠️ Gradients (limited support - use images instead)

### 5. **Use Web-Safe Fonts**

```html
font-family: Arial, Helvetica, sans-serif;
```

Avoid:
- Custom fonts (use web fonts with fallbacks)
- System fonts without fallbacks

### 6. **Fixed Width Container**

Use a fixed width (usually 600px) for main container:
```html
<table width="600" style="max-width: 600px; width: 100%;">
```

### 7. **Media Queries (Responsive)**

Media queries work in many clients if placed in `<head>`:
```html
<style>
  @media only screen and (max-width: 600px) {
    .container { width: 100% !important; }
  }
</style>
```

### 8. **Images**

- Always use absolute URLs: `https://example.com/image.png`
- Include `width` and `height` attributes
- Use `alt` text
- Host images on a reliable CDN

## Email Client Support Matrix

| Feature | Gmail | Outlook | Apple Mail | iOS Mail | Yahoo |
|---------|-------|---------|------------|----------|-------|
| Inline CSS | ✅ | ✅ | ✅ | ✅ | ✅ |
| `<style>` tag | ⚠️ Partial | ❌ | ✅ | ✅ | ⚠️ |
| Media Queries | ✅ | ❌ | ✅ | ✅ | ✅ |
| Table Layout | ✅ | ✅ | ✅ | ✅ | ✅ |
| Flexbox | ❌ | ❌ | ❌ | ❌ | ❌ |
| CSS Gradients | ⚠️ Limited | ❌ | ✅ | ✅ | ⚠️ |

## Solution: Hybrid Approach

1. **Inline styles** for everything critical
2. **`<style>` tag** for media queries and desktop-specific styling
3. **Table-based layouts** for structure
4. **Progressive enhancement** - basic design works everywhere

## Testing Your Email

Test in:
1. Gmail (Web + Mobile app)
2. Outlook (Desktop + Web)
3. Apple Mail
4. iOS Mail app
5. Yahoo Mail
6. Litmus / Email on Acid (paid services)

## Quick Fix Checklist

- [ ] All styles are inline on elements
- [ ] Using table-based layout
- [ ] Fixed width container (600px)
- [ ] Media queries in `<head>` for responsive
- [ ] Images have absolute URLs
- [ ] Web-safe fonts with fallbacks
- [ ] No flexbox/grid
- [ ] Tested in multiple clients

