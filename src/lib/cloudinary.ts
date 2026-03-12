import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadImage(
  imageUrl: string,
  folder: string = "socialmedia-manager"
): Promise<{ url: string; publicId: string }> {
  const result = await cloudinary.uploader.upload(imageUrl, {
    folder,
  });
  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
}

export async function uploadImageBuffer(
  buffer: Buffer,
  folder: string = "socialmedia-manager"
): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder }, (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error("No result from Cloudinary"));
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      })
      .end(buffer);
  });
}

export async function deleteImage(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId);
}

export { cloudinary };
