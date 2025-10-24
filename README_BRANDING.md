# Branding Configuration

## Change Your Brand Name

To change the brand name throughout the entire application, simply update the constant in:

**File:** `src/lib/constants.ts`

```typescript
export const BRAND_NAME = "Groove AI";
```

Change `"Groove AI"` to your desired brand name. This will automatically update:

- Chat header
- Chat message labels
- Landing page
- Authentication pages
- Page titles and meta descriptions
- Footer

## Example

To change from "Groove AI" to "My Custom AI":

```typescript
export const BRAND_NAME = "My Custom AI";
```

That's it! The change will reflect across the entire application.
