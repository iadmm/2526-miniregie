/**
 * Dev seed data — exported as a callable function for use from both
 * the CLI seed script and the admin /jam/reset route.
 */

import { randomUUID } from 'node:crypto';
import { db } from './index.js';
import { participants, mediaItems } from './schema.js';

export const SEED_MARKER = 'seed:dev';

export function applyDevSeed(): void {
  const now = Date.now();

  const fakeParticipants: Array<typeof participants.$inferInsert> = [
    {
      id:          randomUUID(),
      username:    'alice_photo',
      displayName: 'Alice Marchand',
      team:        'Équipe Rouge',
      role:        SEED_MARKER,
      firstSeenAt: now - 1000 * 60 * 30,
      lastSeenAt:  now - 1000 * 60 * 5,
    },
    {
      id:          randomUUID(),
      username:    'bob_video',
      displayName: 'Bob Lejeune',
      team:        'Équipe Bleue',
      role:        SEED_MARKER,
      firstSeenAt: now - 1000 * 60 * 45,
      lastSeenAt:  now - 1000 * 60 * 2,
    },
    {
      id:          randomUUID(),
      username:    'carla_note',
      displayName: 'Carla Dupont',
      team:        'Équipe Verte',
      role:        SEED_MARKER,
      firstSeenAt: now - 1000 * 60 * 20,
      lastSeenAt:  now - 1000 * 60 * 1,
    },
    {
      id:          randomUUID(),
      username:    'david_yt',
      displayName: 'David Renard',
      team:        'Équipe Rouge',
      role:        SEED_MARKER,
      firstSeenAt: now - 1000 * 60 * 60,
      lastSeenAt:  now,
    },
    {
      id:          randomUUID(),
      username:    'emma_cam',
      displayName: 'Emma Fontaine',
      team:        'Équipe Jaune',
      role:        SEED_MARKER,
      firstSeenAt: now - 1000 * 60 * 90,
      lastSeenAt:  now - 1000 * 60 * 8,
    },
    {
      id:          randomUUID(),
      username:    'felix_mix',
      displayName: 'Félix Beaumont',
      team:        'Équipe Bleue',
      role:        SEED_MARKER,
      firstSeenAt: now - 1000 * 60 * 55,
      lastSeenAt:  now - 1000 * 60 * 3,
    },
    {
      id:          randomUUID(),
      username:    'grace_edit',
      displayName: 'Grace Willems',
      team:        'Équipe Verte',
      role:        SEED_MARKER,
      firstSeenAt: now - 1000 * 60 * 110,
      lastSeenAt:  now - 1000 * 60 * 12,
    },
    {
      id:          randomUUID(),
      username:    'hugo_son',
      displayName: 'Hugo Claes',
      team:        'Équipe Jaune',
      role:        SEED_MARKER,
      firstSeenAt: now - 1000 * 60 * 70,
      lastSeenAt:  now - 1000 * 60 * 20,
    },
  ];

  for (const p of fakeParticipants) {
    db.insert(participants).values(p).run();
  }

  function pid(username: string): string {
    return fakeParticipants.find(p => p.username === username)!.id as string;
  }

  type ItemInsert = typeof mediaItems.$inferInsert;

  const fakeItems: ItemInsert[] = [
    // ── Notes ────────────────────────────────────────────────────────────────
    {
      id:          randomUUID(),
      type:        'note',
      content:     { text: 'Pensez à boire de l\'eau, c\'est une longue nuit !' },
      priority:    100,
      status:      'ready',
      submittedAt: now - 1000 * 60 * 25,
      authorId:    pid('carla_note'),
    },
    {
      id:          randomUUID(),
      type:        'note',
      content:     { text: 'Le making-of de la scène 3 est absolument incroyable, vous allez halluciner.' },
      priority:    100,
      status:      'ready',
      submittedAt: now - 1000 * 60 * 12,
      authorId:    pid('carla_note'),
    },
    {
      id:          randomUUID(),
      type:        'note',
      content:     { text: 'Équipe Verte en tête du classement ! On lâche rien jusqu\'à l\'aube.' },
      priority:    100,
      status:      'ready',
      submittedAt: now - 1000 * 60 * 3,
      authorId:    pid('alice_photo'),
    },
    {
      id:          randomUUID(),
      type:        'note',
      content:     { text: 'Scène de l\'ascenseur CONFIRMÉE. C\'était encore mieux que prévu.' },
      priority:    100,
      status:      'ready',
      submittedAt: now - 1000 * 60 * 48,
      authorId:    pid('felix_mix'),
    },
    {
      id:          randomUUID(),
      type:        'note',
      content:     { text: 'Merci à la cantine de la HELB pour les sandwichs de minuit, vous sauvez des vies.' },
      priority:    100,
      status:      'ready',
      submittedAt: now - 1000 * 60 * 37,
      authorId:    pid('grace_edit'),
    },
    {
      id:          randomUUID(),
      type:        'note',
      content:     { text: 'Attention : le couloir du 3e est fermé pour tournage jusqu\'à 4h.' },
      priority:    100,
      status:      'ready',
      submittedAt: now - 1000 * 60 * 19,
      authorId:    pid('hugo_son'),
    },
    {
      id:          randomUUID(),
      type:        'note',
      content:     { text: 'Qui a le câble XLR ? On en a besoin d\'urgence en salle 204.' },
      priority:    100,
      status:      'ready',
      submittedAt: now - 1000 * 60 * 7,
      authorId:    pid('bob_video'),
    },
    {
      id:          randomUUID(),
      type:        'note',
      content:     { text: '17h de tournage au compteur. Équipe Jaune toujours debout, chapeau.' },
      priority:    100,
      status:      'ready',
      submittedAt: now - 1000 * 60 * 2,
      authorId:    pid('emma_cam'),
    },

    // ── Photos (picsum.photos placeholders) ───────────────────────────────────
    {
      id:          randomUUID(),
      type:        'photo',
      content:     { url: 'https://picsum.photos/seed/jam1/1280/720', caption: 'Ambiance plateau — 2h du matin' },
      priority:    100,
      status:      'ready',
      submittedAt: now - 1000 * 60 * 28,
      authorId:    pid('alice_photo'),
    },
    {
      id:          randomUUID(),
      type:        'photo',
      content:     { url: 'https://picsum.photos/seed/jam2/1280/720', caption: null },
      priority:    100,
      status:      'ready',
      submittedAt: now - 1000 * 60 * 18,
      authorId:    pid('bob_video'),
    },
    {
      id:          randomUUID(),
      type:        'photo',
      content:     { url: 'https://picsum.photos/seed/jam3/1280/720', caption: 'Équipe Rouge en plein tournage' },
      priority:    100,
      status:      'ready',
      submittedAt: now - 1000 * 60 * 8,
      authorId:    pid('alice_photo'),
    },
    {
      id:          randomUUID(),
      type:        'photo',
      content:     { url: 'https://picsum.photos/seed/jam4/1280/720', caption: 'Répétition de la scène finale' },
      priority:    100,
      status:      'ready',
      submittedAt: now - 1000 * 60 * 52,
      authorId:    pid('emma_cam'),
    },
    {
      id:          randomUUID(),
      type:        'photo',
      content:     { url: 'https://picsum.photos/seed/jam5/1280/720', caption: null },
      priority:    100,
      status:      'ready',
      submittedAt: now - 1000 * 60 * 44,
      authorId:    pid('grace_edit'),
    },
    {
      id:          randomUUID(),
      type:        'photo',
      content:     { url: 'https://picsum.photos/seed/jam6/1280/720', caption: 'Régie son — Félix aux commandes' },
      priority:    100,
      status:      'ready',
      submittedAt: now - 1000 * 60 * 33,
      authorId:    pid('felix_mix'),
    },
    {
      id:          randomUUID(),
      type:        'photo',
      content:     { url: 'https://picsum.photos/seed/jam7/1280/720', caption: 'Coulisses — Équipe Jaune' },
      priority:    100,
      status:      'ready',
      submittedAt: now - 1000 * 60 * 22,
      authorId:    pid('hugo_son'),
    },
    {
      id:          randomUUID(),
      type:        'photo',
      content:     { url: 'https://picsum.photos/seed/jam8/1280/720', caption: null },
      priority:    100,
      status:      'ready',
      submittedAt: now - 1000 * 60 * 6,
      authorId:    pid('alice_photo'),
    },

    // ── Clips (fake local paths — won't play, exist for queue display) ─────────
    {
      id:          randomUUID(),
      type:        'clip',
      content:     { url: '/uploads/fake-clip-01.mp4', duration: 47, mimeType: 'video/mp4', caption: 'Teaser scène 1 — Équipe Bleue' },
      priority:    100,
      status:      'ready',
      submittedAt: now - 1000 * 60 * 40,
      authorId:    pid('bob_video'),
    },
    {
      id:          randomUUID(),
      type:        'clip',
      content:     { url: '/uploads/fake-clip-02.mp4', duration: 112, mimeType: 'video/mp4', caption: null },
      priority:    100,
      status:      'ready',
      submittedAt: now - 1000 * 60 * 15,
      authorId:    pid('bob_video'),
    },
    {
      id:          randomUUID(),
      type:        'clip',
      content:     { url: '/uploads/fake-clip-03.mp4', duration: 28, mimeType: 'video/mp4', caption: 'Interview improvisée dans le couloir' },
      priority:    100,
      status:      'ready',
      submittedAt: now - 1000 * 60 * 58,
      authorId:    pid('emma_cam'),
    },
    {
      id:          randomUUID(),
      type:        'clip',
      content:     { url: '/uploads/fake-clip-04.mp4', duration: 83, mimeType: 'video/mp4', caption: 'BTS montage nuit — Équipe Verte' },
      priority:    100,
      status:      'ready',
      submittedAt: now - 1000 * 60 * 31,
      authorId:    pid('grace_edit'),
    },
    {
      id:          randomUUID(),
      type:        'clip',
      content:     { url: '/uploads/fake-clip-05.mp4', duration: 204, mimeType: 'video/mp4', caption: null },
      priority:    100,
      status:      'ready',
      submittedAt: now - 1000 * 60 * 14,
      authorId:    pid('felix_mix'),
    },

    // ── YouTube ───────────────────────────────────────────────────────────────
    {
      id:          randomUUID(),
      type:        'youtube',
      content:     { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', youtubeId: 'dQw4w9WgXcQ', title: 'Rick Astley — Never Gonna Give You Up', duration: 213, thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg', caption: 'Classique intemporel' },
      priority:    100,
      status:      'ready',
      submittedAt: now - 1000 * 60 * 35,
      authorId:    pid('david_yt'),
    },
    {
      id:          randomUUID(),
      type:        'youtube',
      content:     { url: 'https://www.youtube.com/watch?v=9bZkp7q19f0', youtubeId: '9bZkp7q19f0', title: 'PSY — Gangnam Style', duration: 252, thumbnail: 'https://img.youtube.com/vi/9bZkp7q19f0/maxresdefault.jpg', caption: null },
      priority:    100,
      status:      'ready',
      submittedAt: now - 1000 * 60 * 10,
      authorId:    pid('david_yt'),
    },
    {
      id:          randomUUID(),
      type:        'youtube',
      content:     { url: 'https://www.youtube.com/watch?v=kJQP7kiw5Fk', youtubeId: 'kJQP7kiw5Fk', title: 'Luis Fonsi — Despacito ft. Daddy Yankee', duration: 282, thumbnail: 'https://img.youtube.com/vi/kJQP7kiw5Fk/maxresdefault.jpg', caption: 'Pour garder l\'énergie à 4h du mat' },
      priority:    100,
      status:      'ready',
      submittedAt: now - 1000 * 60 * 62,
      authorId:    pid('felix_mix'),
    },
    {
      id:          randomUUID(),
      type:        'youtube',
      content:     { url: 'https://www.youtube.com/watch?v=JGwWNGJdvx8', youtubeId: 'JGwWNGJdvx8', title: 'Ed Sheeran — Shape of You', duration: 234, thumbnail: 'https://img.youtube.com/vi/JGwWNGJdvx8/maxresdefault.jpg', caption: null },
      priority:    100,
      status:      'ready',
      submittedAt: now - 1000 * 60 * 41,
      authorId:    pid('emma_cam'),
    },
    {
      id:          randomUUID(),
      type:        'youtube',
      content:     { url: 'https://www.youtube.com/watch?v=OPf0YbXqDm0', youtubeId: 'OPf0YbXqDm0', title: 'Mark Ronson — Uptown Funk ft. Bruno Mars', duration: 270, thumbnail: 'https://img.youtube.com/vi/OPf0YbXqDm0/maxresdefault.jpg', caption: 'Vibes de fin de nuit' },
      priority:    100,
      status:      'ready',
      submittedAt: now - 1000 * 60 * 17,
      authorId:    pid('hugo_son'),
    },

    // ── Ticker ────────────────────────────────────────────────────────────────
    {
      id:          randomUUID(),
      type:        'ticker',
      content:     { text: 'Bienvenue à la 48h IAD ! Toutes les équipes sont en lice — suivez l\'action en direct.', label: 'LIVE' },
      priority:    80,
      status:      'ready',
      submittedAt: now - 1000 * 60 * 60,
      authorId:    'system:admin',
    },
    {
      id:          randomUUID(),
      type:        'ticker',
      content:     { text: 'Rendu final : dimanche à 14h00 en salle A. Ne soyez pas en retard.', label: 'RAPPEL' },
      priority:    80,
      status:      'ready',
      submittedAt: now - 1000 * 60 * 50,
      authorId:    'system:admin',
    },
    {
      id:          randomUUID(),
      type:        'ticker',
      content:     { text: 'Équipe Rouge · Équipe Bleue · Équipe Verte · Équipe Jaune — qui va l\'emporter ?', label: 'CLASSEMENT' },
      priority:    80,
      status:      'ready',
      submittedAt: now - 1000 * 60 * 30,
      authorId:    'system:admin',
    },
    {
      id:          randomUUID(),
      type:        'ticker',
      content:     { text: 'Le jury délibère. Résultats annoncés à 15h30 en amphi.', label: 'JURY' },
      priority:    80,
      status:      'ready',
      submittedAt: now - 1000 * 60 * 5,
      authorId:    'system:admin',
    },
  ];

  for (const item of fakeItems) {
    db.insert(mediaItems).values(item).run();
  }

  console.log(`[dev-seed] Inserted ${fakeParticipants.length} participants and ${fakeItems.length} media items.`);
}
