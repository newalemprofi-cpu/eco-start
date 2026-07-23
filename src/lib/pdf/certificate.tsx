import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

// Kazakh/Russian certificate text is Cyrillic; the PDF standard-14
// fonts (Helvetica etc.) only cover Latin, so a Cyrillic-capable font
// must be embedded explicitly or titles render as blank boxes. Bundled
// locally (not fetched at render time) for reliability — see
// src/lib/pdf/fonts/README for provenance.
let fontsRegistered = false;
function ensureFontsRegistered() {
  if (fontsRegistered) return;
  const dir = path.join(process.cwd(), "src", "lib", "pdf", "fonts");
  Font.register({
    family: "NotoSans",
    fonts: [
      { src: path.join(dir, "NotoSans-Regular.ttf"), fontWeight: 400 },
      { src: path.join(dir, "NotoSans-Bold.ttf"), fontWeight: 700 },
    ],
  });
  fontsRegistered = true;
}

const styles = StyleSheet.create({
  page: {
    padding: 56,
    fontFamily: "NotoSans",
    backgroundColor: "#FAF9F3",
  },
  border: {
    flex: 1,
    borderWidth: 3,
    borderColor: "#1E6E4C",
    borderStyle: "solid",
    borderRadius: 12,
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    fontSize: 12,
    color: "#1E6E4C",
    letterSpacing: 3,
    marginBottom: 18,
  },
  title: {
    fontSize: 30,
    fontWeight: 700,
    color: "#16211B",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: "#5E6D60",
    marginBottom: 30,
  },
  childName: {
    fontSize: 26,
    color: "#1E6E4C",
    marginBottom: 24,
    fontWeight: 700,
  },
  reason: {
    fontSize: 14,
    color: "#16211B",
    textAlign: "center",
    marginBottom: 30,
    maxWidth: 400,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 40,
  },
  footerText: {
    fontSize: 10,
    color: "#5E6D60",
  },
});

export function CertificateDocument({
  childName,
  title,
  reason,
  schoolName,
  issuedAt,
}: {
  childName: string;
  title: string;
  reason: string;
  schoolName: string;
  issuedAt: string;
}) {
  ensureFontsRegistered();
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.border}>
          <Text style={styles.eyebrow}>ЭКО START</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{schoolName}</Text>
          <Text style={styles.childName}>{childName}</Text>
          <Text style={styles.reason}>{reason}</Text>
          <View style={styles.footer}>
            <Text style={styles.footerText}>{new Date(issuedAt).toLocaleDateString()}</Text>
            <Text style={styles.footerText}>«Эко Start» цифрлық орталығы</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
