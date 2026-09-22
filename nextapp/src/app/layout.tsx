 
import "../styles/style.scss";
import "../styles/index.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.altegic.co.za"),
  title: {
    default: "Altegic Solutions - Business Email, Phone & Domains",
    template: "%s | Altegic Solutions",
  },
  description:
    "Business email, phone numbers, domains, and web development for South African small businesses — all under one account, set up in minutes.",
  openGraph: {
    type: "website",
    siteName: "Altegic Solutions",
    title: "Altegic Solutions - Business Email, Phone & Domains",
    description:
      "Business email, phone numbers, domains, and web development for South African small businesses — all under one account, set up in minutes.",
    images: ["/assets/img/logo-full.png"],
  },
  twitter: {
    card: "summary",
    title: "Altegic Solutions - Business Email, Phone & Domains",
    description:
      "Business email, phone numbers, domains, and web development for South African small businesses — all under one account, set up in minutes.",
    images: ["/assets/img/logo-full.png"],
  },
};

// JSON-LD Organization structured data — a real, factual description of
// Altegic for search engines (schema.org Organization type), not
// marketing copy. Address matches the real one already shown on the
// Contact page; no phone number included here since none has been
// provided (the Contact page itself handles that same gap honestly).
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Altegic Solutions",
  url: "https://www.altegic.co.za",
  logo: "https://www.altegic.co.za/assets/img/logo-full.png",
  address: {
    "@type": "PostalAddress",
    streetAddress: "8 Rose Street, Green Point",
    addressLocality: "Cape Town",
    addressRegion: "Western Cape",
    addressCountry: "ZA",
  },
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			 <head> 
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Exo:wght@300;400;500;600;700;800&display=swap"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </head>
			<body>{children}</body>
		</html>
	);
}
