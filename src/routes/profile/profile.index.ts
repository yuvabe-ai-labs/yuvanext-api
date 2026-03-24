import { createRouter } from "@/lib/create-app";

import * as handlers from "./profile.handlers";
import * as routes from "./profile.routes";

const router = createRouter();

router
  // Profile CRUD
  .openapi(routes.getProfile, handlers.getProfile)
  .openapi(routes.updateProfile, handlers.updateProfile)

  // Avatar (both candidates and units)
  .openapi(routes.uploadAvatar, handlers.uploadAvatar)
  .openapi(routes.deleteAvatar, handlers.deleteAvatar)

  // Banner (units only)
  .openapi(routes.uploadBanner, handlers.uploadBanner)
  .openapi(routes.deleteBanner, handlers.deleteBanner)

  // Gallery images (units only)
  .openapi(routes.uploadGalleryImage, handlers.uploadGalleryImage)
  .openapi(routes.deleteGalleryImage, handlers.deleteGalleryImage)

  // Testimonial videos (units only)
  .openapi(
    routes.generateTestimonialUploadUrl,
    handlers.generateTestimonialUploadUrl,
  )
  .openapi(routes.completeTestimonialUpload, handlers.completeTestimonialUpload)
  .openapi(routes.deleteTestimonialVideo, handlers.deleteTestimonialVideo)

  // Mentor Profile
  .openapi(routes.getMentorProfile, handlers.getMentorProfile)
  .openapi(routes.updateMentorProfile, handlers.updateMentorProfile);

export default router;
