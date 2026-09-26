export interface DonationLink {
  label: string;
  url: string;
  enabled: boolean;
}

export interface MonetizationSettings {
  ads_enabled: boolean;
  adsense_publisher_id: string;
  public_content_ad_slot: string;
  consent_management_ready: boolean;
  donations_enabled: boolean;
  donation_links: DonationLink[];
}

export const DEFAULT_MONETIZATION_SETTINGS: MonetizationSettings = {
  ads_enabled: false,
  adsense_publisher_id: '',
  public_content_ad_slot: '',
  consent_management_ready: false,
  donations_enabled: false,
  donation_links: [],
};
