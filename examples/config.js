// SOLN INTEGRATION 1 — Required deployment configuration.
// Replace issuer with your trusted Soln control-plane HTTPS origin (no API path).
// Never read issuer from URL parameters: credentials must only go to your trusted server.
// Deploy this page over HTTPS, then register its final URL in /system/organization
// under Custom Login Page URL. Leave that organization field empty to use the default page.
export const config = {
  issuer: 'https://console.example.com',
  // Optional trusted Runtime /auth/start URL, e.g. 'https://work.example.com/auth/start'.
  // Set this to make direct visits start a real login transaction and return here.
  // Keep null only for a standalone design preview. Never read this URL from query input.
  workspaceLoginUrl: null,
  // OPTIONAL BRANDING — Replace the logo SVG in index.html and the copy in messages.js.
  brandName: 'Soln',
  // Browser tab icon: use an SVG, PNG, or ICO path relative to this page, or an HTTPS URL.
  // Replace the bundled assets/favicon-192x192.png or point this field to your own icon.
  faviconUrl: './assets/favicon-192x192.png',
  // Initial language; the language picker can override it. Unknown languages use English.
  locale: 'zh-CN', // 'en' or 'zh-CN'
};
