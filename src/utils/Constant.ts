import CONFIG from './Config';

const PRODUCTION_URL = 'http://3.110.29.21';
const DEVELOPMENT_URL = 'http://192.168.1.10:8901';

const BASE_URL = CONFIG.production ? PRODUCTION_URL : DEVELOPMENT_URL;
const Constant = {
  API_URL: BASE_URL + '/api',
  IMAGE_URL: BASE_URL + '/image',
  PLACEHOLDER_IMAGE_URL: BASE_URL + '/storage/image.jpg',
  LOCAL_STORAGE: {
    LANGUAGE: 'VOICE_BILLING_lANGUAGE',
    AUTH_TOKEN: 'VOICE_BILLING_AUTH_TOKEN',
    USER_DETAILS: 'PONPAL_APP_USER_DETAILS',
  },
  API_KEY: '25f6da17-31e7-4296-a82c-a3bcabeab0d3',
  ONESIGNAL_APP_ID: '565f9ffd-14ed-4b26-8605-da5199013780',
};

export default Constant;
