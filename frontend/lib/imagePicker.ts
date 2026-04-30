/**
 * Safe Image Picker Utility
 * Provides crash-safe wrappers for expo-image-picker operations
 */

import { Alert, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export type ImagePickerSource = 'camera' | 'gallery';

export type PickedAsset = {
  uri: string;
  name: string;
  mimeType?: string;
  width?: number;
  height?: number;
  fileSize?: number;
  type: 'image' | 'video';
};

export type ImagePickerResult = {
  success: boolean;
  asset?: PickedAsset;
  error?: string;
  canceled?: boolean;
};

/**
 * Validates a picked asset for common issues
 */
export function validatePickedAsset(asset: ImagePicker.ImagePickerAsset): string | null {
  const uri = String(asset?.uri || '');
  if (!uri) return 'Image file is missing URI.';
  if (!(uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('http'))) {
    return 'Unsupported image path.';
  }
  const mime = asset.mimeType || '';
  if (mime && !mime.startsWith('image/') && !mime.startsWith('video/')) {
    return 'Only image and video files are allowed.';
  }
  if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
    return 'File size must be below 10MB.';
  }
  return null;
}

/**
 * Safely requests image picker permission with proper error handling
 */
export async function ensureImagePickerPermission(
  source: ImagePickerSource
): Promise<{ granted: boolean; canAskAgain: boolean }> {
  try {
    const existing = source === 'camera'
      ? await ImagePicker.getCameraPermissionsAsync()
      : await ImagePicker.getMediaLibraryPermissionsAsync();

    console.log('[ImagePicker] Existing permission', {
      source,
      granted: existing?.granted,
      canAskAgain: existing?.canAskAgain,
      status: existing?.status,
    });

    if (existing?.granted) {
      return { granted: true, canAskAgain: true };
    }

    if (!existing?.canAskAgain) {
      Alert.alert(
        'Permission blocked',
        `Please enable ${source} permission from app settings to continue.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => { Linking.openSettings().catch(() => {}); } },
        ],
      );
      return { granted: false, canAskAgain: false };
    }

    const requested = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    console.log('[ImagePicker] Requested permission', {
      source,
      granted: requested?.granted,
      canAskAgain: requested?.canAskAgain,
      status: requested?.status,
    });

    if (requested?.granted) {
      return { granted: true, canAskAgain: requested.canAskAgain };
    }

    Alert.alert('Permission needed', `Please allow ${source} access to continue.`);
    return { granted: false, canAskAgain: requested.canAskAgain };
  } catch (error) {
    console.log('[ImagePicker] ensurePermission ERROR', error);
    Alert.alert('Error', `Unable to request ${source} permission right now.`);
    return { granted: false, canAskAgain: false };
  }
}

/**
 * Safely picks an image from camera or gallery with full error handling
 */
export async function safePickImage(
  source: ImagePickerSource,
  options?: {
    mediaTypes?: 'images' | 'videos' | 'all';
    quality?: number;
    allowsEditing?: boolean;
  }
): Promise<ImagePickerResult> {
  try {
    console.log('[ImagePicker] safePickImage started', { source });

    // Check permission first
    const permission = await ensureImagePickerPermission(source);
    if (!permission.granted) {
      return { success: false, error: 'Permission not granted' };
    }

    // Determine media types
    let mediaTypes: ImagePicker.MediaType[] = ['images'];
    if (options?.mediaTypes === 'videos') {
      mediaTypes = ['videos'];
    } else if (options?.mediaTypes === 'all') {
      mediaTypes = ['images', 'videos'];
    }

    // Launch picker with try-catch
    let result: ImagePicker.ImagePickerResult;
    try {
      if (source === 'camera') {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes,
          quality: options?.quality ?? 0.7,
          allowsEditing: options?.allowsEditing ?? false,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes,
          quality: options?.quality ?? 0.7,
          allowsEditing: options?.allowsEditing ?? false,
        });
      }
    } catch (pickerError: any) {
      console.log('[ImagePicker] Native picker launch ERROR', pickerError);
      const errorMessage = pickerError?.message || 'Unable to open image picker right now.';
      Alert.alert('Error', errorMessage);
      return { success: false, error: errorMessage };
    }

    console.log('[ImagePicker] Picker result', {
      canceled: result.canceled,
      assetsCount: result?.assets?.length || 0,
    });

    // Handle cancellation
    if (result.canceled) {
      return { success: false, canceled: true };
    }

    // Validate asset
    const asset = result?.assets?.[0];
    if (!asset?.uri) {
      return { success: false, error: 'No file selected' };
    }

    const validationError = validatePickedAsset(asset);
    if (validationError) {
      Alert.alert('Invalid File', validationError);
      return { success: false, error: validationError };
    }

    // Return successful result
    return {
      success: true,
      asset: {
        uri: asset.uri,
        name: asset.fileName || `picked-${Date.now()}`,
        mimeType: asset.mimeType,
        width: asset.width,
        height: asset.height,
        fileSize: asset.fileSize,
        type: asset.type === 'video' ? 'video' : 'image',
      },
    };
  } catch (error: any) {
    console.log('[ImagePicker] safePickImage ERROR', error);
    const errorMessage = error?.message || 'Failed to pick image.';
    Alert.alert('Error', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Safely picks an image from gallery (convenience function)
 */
export async function safePickFromGallery(
  options?: { mediaTypes?: 'images' | 'videos' | 'all'; quality?: number }
): Promise<ImagePickerResult> {
  return safePickImage('gallery', options);
}

/**
 * Safely takes a photo with camera (convenience function)
 */
export async function safePickFromCamera(
  options?: { quality?: number; allowsEditing?: boolean }
): Promise<ImagePickerResult> {
  return safePickImage('camera', { ...options, mediaTypes: 'images' });
}
