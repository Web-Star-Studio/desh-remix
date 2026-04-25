/**
 * Social Media & Ads Platform Configuration
 * All platforms are accessed via Composio through composio-proxy
 */

export interface SocialPlatformConfig {
  id: string;
  name: string;
  icon: string; // lucide icon name
  category: 'social' | 'ads' | 'analytics';
  composioToolkit: string;
  actions: {
    getProfile?: string;
    getPosts?: string;
    getInsights?: string;
    getCampaigns?: string;
    getMetrics?: string;
  };
  color: string;
}

export const SOCIAL_PLATFORMS: SocialPlatformConfig[] = [
  // ── Social Networks ──
  {
    id: 'instagram',
    name: 'Instagram',
    icon: 'camera',
    category: 'social',
    composioToolkit: 'instagram',
    actions: {
      getProfile: 'INSTAGRAM_GET_USER_MEDIA',
      getPosts: 'INSTAGRAM_GET_USER_MEDIA',
      getInsights: 'INSTAGRAM_GET_USER_MEDIA',
    },
    color: '#E4405F',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: 'thumbs-up',
    category: 'social',
    composioToolkit: 'facebook',
    actions: {
      getProfile: 'FACEBOOK_GET_PAGE_DETAILS',
      getPosts: 'FACEBOOK_GET_PAGE_POSTS',
      getInsights: 'FACEBOOK_GET_PAGE_INSIGHTS',
    },
    color: '#1877F2',
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    icon: 'at-sign',
    category: 'social',
    composioToolkit: 'twitter',
    actions: {
      getProfile: 'TWITTER_USER_LOOKUP_ME',
      getPosts: 'TWITTER_USER_TIMELINE',
      getInsights: 'TWITTER_BOOKMARKS_BY_USER',
    },
    color: '#000000',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: 'briefcase',
    category: 'social',
    composioToolkit: 'linkedin',
    actions: {
      getProfile: 'LINKEDIN_GET_USER_PROFILE',
      getPosts: 'LINKEDIN_CREATE_LINKED_IN_POST',
      getInsights: 'LINKEDIN_GET_MY_INFO',
    },
    color: '#0A66C2',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    icon: 'play',
    category: 'social',
    composioToolkit: 'youtube',
    actions: {
      getProfile: 'YOUTUBE_LIST_USER_PLAYLISTS',
      getPosts: 'YOUTUBE_SEARCH_YOU_TUBE',
      getInsights: 'YOUTUBE_LIST_USER_PLAYLISTS',
    },
    color: '#FF0000',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: 'music',
    category: 'social',
    composioToolkit: 'tiktok',
    actions: {
      getProfile: 'TIKTOK_GET_USER_INFO',
      getPosts: 'TIKTOK_GET_USER_VIDEOS',
      getInsights: 'TIKTOK_GET_USER_VIDEOS',
    },
    color: '#010101',
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    icon: 'pin',
    category: 'social',
    composioToolkit: 'pinterest',
    actions: {
      getProfile: 'PINTEREST_GET_USER_ACCOUNT',
      getPosts: 'PINTEREST_LIST_PINS',
      getInsights: 'PINTEREST_GET_USER_ACCOUNT',
    },
    color: '#E60023',
  },

  // ── Ads ──
  {
    id: 'google-ads',
    name: 'Google Ads',
    icon: 'megaphone',
    category: 'ads',
    composioToolkit: 'googleads',
    actions: {
      getCampaigns: 'GOOGLEADS_GET_CAMPAIGN_BY_NAME',
      getMetrics: 'GOOGLEADS_GET_CAMPAIGN_BY_ID',
      getInsights: 'GOOGLEADS_GET_CUSTOMER_LISTS',
    },
    color: '#4285F4',
  },
  {
    id: 'facebook-ads',
    name: 'Facebook Ads',
    icon: 'target',
    category: 'ads',
    composioToolkit: 'facebookads',
    actions: {
      getCampaigns: 'FACEBOOKADS_GET_CAMPAIGNS',
      getMetrics: 'FACEBOOKADS_GET_AD_INSIGHTS',
      getInsights: 'FACEBOOKADS_GET_AD_INSIGHTS',
    },
    color: '#1877F2',
  },
  {
    id: 'linkedin-ads',
    name: 'LinkedIn Ads',
    icon: 'badge-dollar-sign',
    category: 'ads',
    composioToolkit: 'linkedinads',
    actions: {
      getCampaigns: 'LINKEDINADS_GET_CAMPAIGNS',
      getMetrics: 'LINKEDINADS_GET_AD_ANALYTICS',
      getInsights: 'LINKEDINADS_GET_AD_ANALYTICS',
    },
    color: '#0A66C2',
  },
  {
    id: 'tiktok-ads',
    name: 'TikTok Ads',
    icon: 'music-2',
    category: 'ads',
    composioToolkit: 'tiktokads',
    actions: {
      getCampaigns: 'TIKTOKADS_GET_CAMPAIGNS',
      getMetrics: 'TIKTOKADS_GET_AD_REPORT',
      getInsights: 'TIKTOKADS_GET_AD_REPORT',
    },
    color: '#010101',
  },

  // ── Analytics ──
  {
    id: 'google-analytics',
    name: 'Google Analytics',
    icon: 'line-chart',
    category: 'analytics',
    composioToolkit: 'googleanalytics',
    actions: {
      getMetrics: 'GOOGLEANALYTICS_GET_REPORT',
      getInsights: 'GOOGLEANALYTICS_GET_REPORT',
    },
    color: '#E37400',
  },
];

/** Get platforms by category */
export const getSocialPlatforms = () => SOCIAL_PLATFORMS.filter(p => p.category === 'social');
export const getAdsPlatforms = () => SOCIAL_PLATFORMS.filter(p => p.category === 'ads');
export const getAnalyticsPlatforms = () => SOCIAL_PLATFORMS.filter(p => p.category === 'analytics');
export const getPlatformById = (id: string) => SOCIAL_PLATFORMS.find(p => p.id === id);
