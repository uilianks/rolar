// Web build: printing the QR screen prints the poster alone. A copy of it is mounted straight under
// <body> (outside the app's scroll views and sidebar) and the print stylesheet hides everything else.
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { View } from "react-native";

import { Poster } from "./qr-poster-card";

export { Poster };

const PRINT_CSS = `
#qr-print { display: none; }
@media print {
  body > *:not(#qr-print) { display: none !important; }
  #qr-print { display: flex !important; flex-direction: column; align-items: center; width: 100%; padding-top: 18mm; }
  #qr-print * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  #qr-print > * > * { border: none !important; box-shadow: none !important; }
}`;

export function PrintPoster({ academyId, name }: { academyId: string; name: string }) {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = PRINT_CSS;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
  return createPortal(
    <View nativeID="qr-print">
      <View style={{ width: 520 }}>
        <Poster academyId={academyId} name={name} />
      </View>
    </View>,
    document.body,
  );
}
