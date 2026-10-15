// Profile photo: pick from the gallery, crop to a centred square, shrink to 256×256 JPEG, upload.
// Doing it on the phone keeps uploads ~20 KB and the API free of image processing.
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

import { api } from "./api";

const SIZE = 256;

/** Returns the new photo URL, or null if the person cancelled. */
export async function pickAndUploadAvatar(): Promise<string | null> {
  // Android 13+ and the web use the system photo picker: no permission prompt.
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 });
  if (picked.canceled || !picked.assets[0]) return null;
  const { uri, width, height } = picked.assets[0];
  const side = Math.min(width, height);
  const ref = await ImageManipulator.manipulate(uri)
    .crop({ originX: Math.floor((width - side) / 2), originY: Math.floor((height - side) / 2), width: side, height: side })
    .resize({ width: SIZE, height: SIZE })
    .renderAsync();
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  const { avatarUrl } = await api<{ avatarUrl: string }>("/me/avatar", { method: "PUT", json: { image: `data:image/jpeg;base64,${out.base64}` } });
  return avatarUrl;
}

export async function removeAvatar() {
  await api("/me/avatar", { method: "DELETE" });
}
