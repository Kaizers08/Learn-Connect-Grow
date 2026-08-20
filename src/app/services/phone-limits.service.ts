import { Injectable } from '@angular/core';

export interface PhoneLimit {
  min: number;
  max: number;
}

@Injectable({ providedIn: 'root' })
export class PhoneLimitsService {

  private readonly limits: Record<string, PhoneLimit> = {
    'Afghanistan': { min: 9, max: 9 },
    'Albania': { min: 9, max: 9 },
    'Algeria': { min: 9, max: 9 },
    'Andorra': { min: 6, max: 9 },
    'Angola': { min: 9, max: 9 },
    'Argentina': { min: 10, max: 11 },
    'Armenia': { min: 8, max: 8 },
    'Australia': { min: 9, max: 9 },
    'Austria': { min: 7, max: 13 },
    'Azerbaijan': { min: 9, max: 9 },
    'Bahamas': { min: 10, max: 10 },
    'Bahrain': { min: 8, max: 8 },
    'Bangladesh': { min: 10, max: 10 },
    'Belarus': { min: 9, max: 9 },
    'Belgium': { min: 9, max: 9 },
    'Bolivia': { min: 8, max: 8 },
    'Bosnia and Herzegovina': { min: 8, max: 8 },
    'Brazil': { min: 10, max: 11 },
    'Bulgaria': { min: 8, max: 9 },
    'Cambodia': { min: 8, max: 9 },
    'Cameroon': { min: 9, max: 9 },
    'Canada': { min: 10, max: 10 },
    'Chile': { min: 9, max: 9 },
    'China': { min: 11, max: 11 },
    'Colombia': { min: 10, max: 10 },
    'Costa Rica': { min: 8, max: 8 },
    'Croatia': { min: 8, max: 9 },
    'Cuba': { min: 8, max: 8 },
    'Czech Republic': { min: 9, max: 9 },
    'Denmark': { min: 8, max: 8 },
    'Dominican Republic': { min: 10, max: 10 },
    'Ecuador': { min: 9, max: 9 },
    'Egypt': { min: 10, max: 10 },
    'El Salvador': { min: 8, max: 8 },
    'Estonia': { min: 7, max: 8 },
    'Ethiopia': { min: 9, max: 9 },
    'Finland': { min: 7, max: 10 },
    'France': { min: 9, max: 9 },
    'Georgia': { min: 9, max: 9 },
    'Germany': { min: 10, max: 11 },
    'Ghana': { min: 9, max: 9 },
    'Greece': { min: 10, max: 10 },
    'Guatemala': { min: 8, max: 8 },
    'Honduras': { min: 8, max: 8 },
    'Hungary': { min: 9, max: 9 },
    'India': { min: 10, max: 10 },
    'Indonesia': { min: 9, max: 12 },
    'Iran': { min: 10, max: 10 },
    'Iraq': { min: 10, max: 10 },
    'Ireland': { min: 9, max: 9 },
    'Israel': { min: 9, max: 9 },
    'Italy': { min: 9, max: 11 },
    'Jamaica': { min: 10, max: 10 },
    'Japan': { min: 10, max: 11 },
    'Jordan': { min: 9, max: 9 },
    'Kazakhstan': { min: 10, max: 10 },
    'Kenya': { min: 9, max: 10 },
    'Kuwait': { min: 8, max: 8 },
    'Latvia': { min: 8, max: 8 },
    'Lebanon': { min: 7, max: 8 },
    'Libya': { min: 9, max: 9 },
    'Lithuania': { min: 8, max: 8 },
    'Luxembourg': { min: 9, max: 9 },
    'Malaysia': { min: 9, max: 10 },
    'Mexico': { min: 10, max: 10 },
    'Morocco': { min: 9, max: 9 },
    'Myanmar': { min: 8, max: 10 },
    'Nepal': { min: 10, max: 10 },
    'Netherlands': { min: 9, max: 9 },
    'New Zealand': { min: 8, max: 10 },
    'Nicaragua': { min: 8, max: 8 },
    'Nigeria': { min: 10, max: 11 },
    'Norway': { min: 8, max: 8 },
    'Pakistan': { min: 10, max: 11 },
    'Panama': { min: 8, max: 8 },
    'Paraguay': { min: 9, max: 9 },
    'Peru': { min: 9, max: 9 },
    'Philippines': { min: 10, max: 11 },
    'Poland': { min: 9, max: 9 },
    'Portugal': { min: 9, max: 9 },
    'Qatar': { min: 8, max: 8 },
    'Romania': { min: 9, max: 10 },
    'Russia': { min: 10, max: 10 },
    'Saudi Arabia': { min: 9, max: 9 },
    'Serbia': { min: 8, max: 9 },
    'Singapore': { min: 8, max: 8 },
    'Slovakia': { min: 9, max: 9 },
    'South Africa': { min: 9, max: 9 },
    'South Korea': { min: 10, max: 11 },
    'Spain': { min: 9, max: 9 },
    'Sri Lanka': { min: 9, max: 10 },
    'Sudan': { min: 9, max: 9 },
    'Sweden': { min: 7, max: 10 },
    'Switzerland': { min: 9, max: 9 },
    'Syria': { min: 9, max: 9 },
    'Taiwan': { min: 9, max: 10 },
    'Tanzania': { min: 9, max: 9 },
    'Thailand': { min: 9, max: 9 },
    'Tunisia': { min: 8, max: 8 },
    'Turkey': { min: 10, max: 10 },
    'Ukraine': { min: 9, max: 9 },
    'United Arab Emirates': { min: 9, max: 9 },
    'United Kingdom': { min: 10, max: 10 },
    'United States': { min: 10, max: 10 },
    'Uruguay': { min: 8, max: 9 },
    'Uzbekistan': { min: 9, max: 9 },
    'Venezuela': { min: 10, max: 11 },
    'Vietnam': { min: 9, max: 10 },
    'Yemen': { min: 9, max: 9 },
    'Zimbabwe': { min: 9, max: 9 },
  };

  /** Returns min/max digit limits for the given country, or a safe fallback. */
  getLimits(country: string): PhoneLimit {
    return this.limits[country] ?? { min: 7, max: 15 };
  }

  /** Human-readable hint string, e.g. "Philippines: 10–11 digits" */
  getHint(country: string): string {
    if (!country || !this.limits[country]) return 'Enter your phone number';
    const { min, max } = this.limits[country];
    return min === max
      ? `${country}: ${min} digits required`
      : `${country}: ${min}–${max} digits`;
  }

  /** Strips spaces from a phone string and returns the digit count. */
  countDigits(phone: string): number {
    return phone.replace(/\s/g, '').length;
  }

  /** All country names (same list as settingsCountries). */
  readonly countries: string[] = [
    'Afghanistan','Albania','Algeria','Andorra','Angola','Argentina','Armenia',
    'Australia','Austria','Azerbaijan','Bahamas','Bahrain','Bangladesh','Belarus',
    'Belgium','Bolivia','Bosnia and Herzegovina','Brazil','Bulgaria','Cambodia',
    'Cameroon','Canada','Chile','China','Colombia','Costa Rica','Croatia','Cuba',
    'Czech Republic','Denmark','Dominican Republic','Ecuador','Egypt','El Salvador',
    'Estonia','Ethiopia','Finland','France','Georgia','Germany','Ghana','Greece',
    'Guatemala','Honduras','Hungary','India','Indonesia','Iran','Iraq','Ireland',
    'Israel','Italy','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kuwait',
    'Latvia','Lebanon','Libya','Lithuania','Luxembourg','Malaysia','Mexico',
    'Morocco','Myanmar','Nepal','Netherlands','New Zealand','Nicaragua','Nigeria',
    'Norway','Pakistan','Panama','Paraguay','Peru','Philippines','Poland',
    'Portugal','Qatar','Romania','Russia','Saudi Arabia','Serbia','Singapore',
    'Slovakia','South Africa','South Korea','Spain','Sri Lanka','Sudan','Sweden',
    'Switzerland','Syria','Taiwan','Tanzania','Thailand','Tunisia','Turkey',
    'Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay',
    'Uzbekistan','Venezuela','Vietnam','Yemen','Zimbabwe',
  ];
}
