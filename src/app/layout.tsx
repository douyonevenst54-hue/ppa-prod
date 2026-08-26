import type { Metadata } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import { AuthProvider } from "@/components/AuthProvider";
import PiBrowserBanner from "@/components/PiBrowserBanner";
import LegalFooter from "@/components/LegalFooter";
import AgeGate from "@/components/AgeGate";

export const metadata: Metadata = {
  title: "Pap-Pad-App",
  description: "Predict. Challenge. Earn.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script src="https://sdk.minepi.com/pi-sdk.js" />
      </head>
      <body>
        <AuthProvider>
          <PiBrowserBanner>
            {children}
            {/* Terms, privacy and support on every page. Previously there was no
                route to any of them anywhere in the app. */}
            <LegalFooter />
            <BottomNav />
          </PiBrowserBanner>
          {/* Renders only when the signed-in user has no age attestation. */}
          <AgeGate />
        </AuthProvider>
      </body>
    </html>
  );
}
