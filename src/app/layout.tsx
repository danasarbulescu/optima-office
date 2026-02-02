import type { Metadata } from "next";
import ConfigureAmplify from "@/components/ConfigureAmplify";
import "@aws-amplify/ui-react/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Financial Dashboard",
  description: "Financial dashboard powered by CData Connect Cloud",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ConfigureAmplify />
        {children}
      </body>
    </html>
  );
}
