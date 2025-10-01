/**
 * Strava athlete data types
 */

/**
 * Authenticated athlete from OAuth response
 */
export interface AuthenticatedAthlete {
  readonly id: number;
  readonly username?: string;
  readonly resource_state: number;
  readonly firstname?: string;
  readonly lastname?: string;
  readonly bio?: string;
  readonly city?: string;
  readonly state?: string;
  readonly country?: string;
  readonly sex?: string;
  readonly premium?: boolean;
  readonly summit?: boolean;
  readonly created_at?: string;
  readonly updated_at?: string;
  readonly badge_type_id?: number;
  readonly weight?: number;
  readonly profile_medium?: string;
  readonly profile?: string;
  readonly friend?: null;
  readonly follower?: null;
  readonly measurement_preference?: "feet" | "meters";
}

/**
 * Detailed athlete data
 */
export interface DetailedAthlete extends AuthenticatedAthlete {
  readonly follower_count?: number;
  readonly friend_count?: number;
  readonly mutual_friend_count?: number;
  readonly athlete_type?: number;
  readonly date_preference?: string;
  readonly clubs?: readonly any[];
  readonly bikes?: readonly any[];
  readonly shoes?: readonly any[];
}
