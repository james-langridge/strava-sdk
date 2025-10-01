/**
 * Strava activity data types
 */

/**
 * Strava activity from API
 */
export interface StravaActivity {
  readonly id: number;
  readonly name: string;
  readonly distance: number;
  readonly moving_time: number;
  readonly elapsed_time: number;
  readonly total_elevation_gain: number;
  readonly type: string;
  readonly start_date: string;
  readonly start_date_local: string;
  readonly timezone: string;
  readonly start_latlng: readonly [number, number] | null;
  readonly end_latlng: readonly [number, number] | null;
  readonly location_city?: string;
  readonly location_state?: string;
  readonly location_country?: string;
  readonly achievement_count: number;
  readonly kudos_count: number;
  readonly comment_count: number;
  readonly athlete_count: number;
  readonly photo_count: number;
  readonly description?: string;
  readonly private: boolean;
  readonly visibility: string;
}

/**
 * Strava activity update data
 */
export interface StravaUpdateData {
  readonly name?: string;
  readonly type?: string;
  readonly description?: string;
  readonly gear_id?: string;
  readonly trainer?: boolean;
  readonly commute?: boolean;
}

/**
 * Activity statistics
 */
export interface ActivityStats {
  readonly biggest_ride_distance?: number;
  readonly biggest_climb_elevation_gain?: number;
  readonly recent_ride_totals?: ActivityTotal;
  readonly recent_run_totals?: ActivityTotal;
  readonly recent_swim_totals?: ActivityTotal;
  readonly ytd_ride_totals?: ActivityTotal;
  readonly ytd_run_totals?: ActivityTotal;
  readonly ytd_swim_totals?: ActivityTotal;
  readonly all_ride_totals?: ActivityTotal;
  readonly all_run_totals?: ActivityTotal;
  readonly all_swim_totals?: ActivityTotal;
}

/**
 * Activity totals
 */
export interface ActivityTotal {
  readonly count: number;
  readonly distance: number;
  readonly moving_time: number;
  readonly elapsed_time: number;
  readonly elevation_gain: number;
  readonly achievement_count?: number;
}

/**
 * Activity streams data
 */
export interface ActivityStreams {
  readonly [key: string]: StreamData;
}

export interface StreamData {
  readonly data: readonly any[];
  readonly series_type: string;
  readonly original_size: number;
  readonly resolution: string;
}
