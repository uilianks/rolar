// Profile photo: pick from the gallery, the person frames it (AvatarCropper), then it is cropped and
// shrunk to a 256×256 JPEG here. Doing it on the phone keeps uploads ~20 KB and the API free of image processing.
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

import { api } from "./api";

const SIZE = 256;

export type PickedImage = { uri: string; width: number; height: number };
/** A square of the original image, in its pixels. */
export type CropRect = { originX: number; originY: number; size: number };

/** Returns null if the person cancelled. Android 13+ and the web use the system photo picker: no permission prompt. */
export async function pickImage(): Promise<PickedImage | null> {
  // No allowsEditing: the web has no editor, so AvatarCropper frames the photo on every platform.
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 1,
  });
  const asset = picked.canceled ? undefined : picked.assets[0];
  return asset ? { uri: asset.uri, width: asset.width, height: asset.height } : null;
}

/** Returns the new photo URL. */
export async function uploadAvatar(image: PickedImage, { originX, originY, size }: CropRect): Promise<string> {
  const ref = await ImageManipulator.manipulate(image.uri).crop({ originX, originY, width: size, height: size }).resize({ width: SIZE, height: SIZE }).renderAsync();
  const out = await ref.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.8,
    base64: true,
  });
  const { avatarUrl } = await api<{ avatarUrl: string }>("/me/avatar", {
    method: "PUT",
    json: { image: `data:image/jpeg;base64,${out.base64}` },
  });
  return avatarUrl;
}

export async function removeAvatar() {
  await api("/me/avatar", { method: "DELETE" });
}
