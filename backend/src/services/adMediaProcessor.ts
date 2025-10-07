import { storageService, MediaItem } from './storageService.js';

export interface ProcessedAdMedia {
  images: string[];
  videos: string[];
  originalImages: string[];
  originalVideos: string[];
}

export class AdMediaProcessor {
  /**
   * Process and upload all media from an ad to MinIO
   */
  static async processAdMedia(adData: any, adId: string): Promise<ProcessedAdMedia> {
    const processedMedia: ProcessedAdMedia = {
      images: [],
      videos: [],
      originalImages: [],
      originalVideos: []
    };

    try {
      console.log(`🎬 Processing media for ad: ${adId}`);

      // Extract all media URLs from the ad data
      const mediaItems: MediaItem[] = [];

      // Process images from apify_data
      if (adData.apify_data?.images) {
        adData.apify_data.images.forEach((imageUrl: string) => {
          if (imageUrl && typeof imageUrl === 'string') {
            mediaItems.push({
              url: imageUrl,
              type: 'image',
              originalUrl: imageUrl
            });
            processedMedia.originalImages.push(imageUrl);
          }
        });
      }

      // Process videos from apify_data
      if (adData.apify_data?.videos) {
        adData.apify_data.videos.forEach((video: any) => {
          if (video.video_hd_url) {
            mediaItems.push({
              url: video.video_hd_url,
              type: 'video',
              originalUrl: video.video_hd_url
            });
            processedMedia.originalVideos.push(video.video_hd_url);
          } else if (video.video_sd_url) {
            mediaItems.push({
              url: video.video_sd_url,
              type: 'video',
              originalUrl: video.video_sd_url
            });
            processedMedia.originalVideos.push(video.video_sd_url);
          }
        });
      }

      // Process images from scrapecreators_data
      if (adData.scrapecreators_data?.images_detailed) {
        adData.scrapecreators_data.images_detailed.forEach((image: any) => {
          if (image.url && typeof image.url === 'string') {
            mediaItems.push({
              url: image.url,
              type: 'image',
              originalUrl: image.url
            });
            processedMedia.originalImages.push(image.url);
          }
        });
      }

      // Process profile picture if available
      if (adData.apify_data?.page_profile_picture_url) {
        mediaItems.push({
          url: adData.apify_data.page_profile_picture_url,
          type: 'image',
          originalUrl: adData.apify_data.page_profile_picture_url
        });
        processedMedia.originalImages.push(adData.apify_data.page_profile_picture_url);
      }

      if (adData.scrapecreators_data?.page_profile_picture_url) {
        mediaItems.push({
          url: adData.scrapecreators_data.page_profile_picture_url,
          type: 'image',
          originalUrl: adData.scrapecreators_data.page_profile_picture_url
        });
        processedMedia.originalImages.push(adData.scrapecreators_data.page_profile_picture_url);
      }

      console.log(`📊 Found ${mediaItems.length} media items to process`);

      if (mediaItems.length === 0) {
        console.log(`⚠️ No media items found for ad: ${adId}`);
        return processedMedia;
      }

      // Upload all media to MinIO
      const uploadResult = await storageService.uploadMultipleMedia(
        mediaItems, 
        `ads/${adId}/media`
      );

      // Process successful uploads
      uploadResult.successful.forEach((result, index) => {
        const mediaItem = mediaItems[index];
        if (mediaItem.type === 'image') {
          processedMedia.images.push(result.url!);
        } else if (mediaItem.type === 'video') {
          processedMedia.videos.push(result.url!);
        }
      });

      console.log(`✅ Media processing completed for ad ${adId}:`);
      console.log(`   - Images: ${processedMedia.images.length}/${processedMedia.originalImages.length}`);
      console.log(`   - Videos: ${processedMedia.videos.length}/${processedMedia.originalVideos.length}`);
      console.log(`   - Failed: ${uploadResult.failed.length}`);

      return processedMedia;

    } catch (error) {
      console.error(`❌ Error processing media for ad ${adId}:`, error);
      return processedMedia;
    }
  }

  /**
   * Update ad data with processed media URLs
   */
  static updateAdDataWithProcessedMedia(adData: any, processedMedia: ProcessedAdMedia): any {
    const updatedAdData = { ...adData };

    // Update apify_data images
    if (updatedAdData.apify_data && processedMedia.images.length > 0) {
      updatedAdData.apify_data.images = processedMedia.images;
    }

    // Update apify_data videos
    if (updatedAdData.apify_data && processedMedia.videos.length > 0) {
      updatedAdData.apify_data.videos = processedMedia.videos.map(url => ({
        video_hd_url: url,
        video_sd_url: url
      }));
    }

    // Update scrapecreators_data images
    if (updatedAdData.scrapecreators_data && processedMedia.images.length > 0) {
      updatedAdData.scrapecreators_data.images_detailed = processedMedia.images.map(url => ({
        url: url,
        original_url: url,
        resized_url: url,
        watermarked_url: null,
        crops: []
      }));
    }

    // Update profile pictures
    if (processedMedia.images.length > 0) {
      const profileImage = processedMedia.images[0]; // Use first image as profile picture
      
      if (updatedAdData.apify_data) {
        updatedAdData.apify_data.page_profile_picture_url = profileImage;
      }
      
      if (updatedAdData.scrapecreators_data) {
        updatedAdData.scrapecreators_data.page_profile_picture_url = profileImage;
      }
    }

    return updatedAdData;
  }

  /**
   * Process media for bulk ads
   */
  static async processBulkAdsMedia(ads: any[]): Promise<{
    processedAds: any[];
    totalProcessed: number;
    totalFailed: number;
  }> {
    const processedAds: any[] = [];
    let totalProcessed = 0;
    let totalFailed = 0;

    for (const ad of ads) {
      try {
        const processedMedia = await this.processAdMedia(ad, ad.id);
        const updatedAdData = this.updateAdDataWithProcessedMedia(ad, processedMedia);
        
        processedAds.push(updatedAdData);
        totalProcessed++;
      } catch (error) {
        console.error(`❌ Error processing media for ad ${ad.id}:`, error);
        processedAds.push(ad); // Keep original ad if processing fails
        totalFailed++;
      }
    }

    return {
      processedAds,
      totalProcessed,
      totalFailed
    };
  }
}
