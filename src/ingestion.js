import appStore from 'app-store-scraper';
import playStore from 'google-play-scraper';
import { normalizeAndSanitizeReview } from './sanitizer.js';

const WEEKS_TO_FETCH = 10;
const DATE_THRESHOLD = new Date();
DATE_THRESHOLD.setDate(DATE_THRESHOLD.getDate() - (WEEKS_TO_FETCH * 7));

/**
 * Fetches recent reviews from the iOS App Store.
 * @param {string} appId - The iOS App ID (e.g., '553834731' for Candy Crush).
 * @returns {Promise<Array>} Array of normalized reviews.
 */
export async function fetchAppStoreReviews(appId) {
  if (!appId) {
    console.warn('No App Store ID provided, skipping iOS reviews.');
    return [];
  }

  console.log(`Fetching App Store reviews for ID: ${appId}...`);
  try {
    let allReviews = [];
    let page = 1;
    let keepFetching = true;

    while (keepFetching && page <= 10) { // Safety limit: max 10 pages (500 reviews)
      const reviews = await appStore.reviews({
        appId: appId,
        country: 'in',
        sort: appStore.sort.RECENT,
        page: page,
      });

      if (!reviews || reviews.length === 0) break;

      for (const review of reviews) {
        const reviewDate = new Date(review.updated || review.date);
        if (reviewDate >= DATE_THRESHOLD) {
          allReviews.push(normalizeAndSanitizeReview(review, 'app-store'));
        } else {
          // Since it's sorted by recent, once we hit an old review, we can stop
          keepFetching = false;
          break;
        }
      }
      page++;
    }

    console.log(`Fetched ${allReviews.length} iOS reviews.`);
    return allReviews;
  } catch (error) {
    console.error('Error fetching App Store reviews:', error.message);
    return [];
  }
}

/**
 * Fetches recent reviews from the Google Play Store.
 * @param {string} appId - The Play Store package name (e.g., 'com.king.candycrushsaga').
 * @returns {Promise<Array>} Array of normalized reviews.
 */
export async function fetchPlayStoreReviews(appId) {
  if (!appId) {
    console.warn('No Play Store App ID provided, skipping Android reviews.');
    return [];
  }

  console.log(`Fetching Play Store reviews for ID: ${appId}...`);
  try {
    const reviewsData = await playStore.reviews({
      appId: appId,
      sort: playStore.sort.NEWEST,
      num: 500, // Fetch up to 500 recent reviews at once
    });

    const rawReviews = reviewsData.data || [];
    const recentReviews = [];

    for (const review of rawReviews) {
      const reviewDate = new Date(review.date);
      if (reviewDate >= DATE_THRESHOLD) {
        recentReviews.push(normalizeAndSanitizeReview(review, 'play-store'));
      }
    }

    console.log(`Fetched ${recentReviews.length} Android reviews.`);
    return recentReviews;
  } catch (error) {
    console.error('Error fetching Play Store reviews:', error.message);
    return [];
  }
}

/**
 * Orchestrates fetching from both stores and returns a unified array.
 */
export async function fetchAllReviews(iosAppId, androidAppId) {
  const [iosReviews, androidReviews] = await Promise.all([
    fetchAppStoreReviews(iosAppId),
    fetchPlayStoreReviews(androidAppId)
  ]);

  return [...iosReviews, ...androidReviews];
}
