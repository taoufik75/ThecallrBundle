import type { RawContact } from 'contxt-domain';
import type { CountryCode } from 'libphonenumber-js';
import { googlePersonToRaw, type GooglePerson } from './googlePeopleMap';

interface ConnectionsResponse {
  readonly connections?: readonly GooglePerson[];
  readonly nextPageToken?: string;
}

/**
 * Récupère les contacts Google de l'utilisateur via l'API People, à partir d'un
 * jeton d'accès OAuth, et les convertit en `RawContact`. Gère la pagination.
 */
export async function fetchGooglePeople(
  accessToken: string,
  region: CountryCode = 'FR',
): Promise<RawContact[]> {
  const raws: RawContact[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      personFields: 'names,emailAddresses,phoneNumbers',
      pageSize: '200',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetch(
      `https://people.googleapis.com/v1/people/me/connections?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) throw new Error(`People API ${res.status}`);

    const data = (await res.json()) as ConnectionsResponse;
    for (const p of data.connections ?? []) raws.push(googlePersonToRaw(p, region));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return raws;
}
