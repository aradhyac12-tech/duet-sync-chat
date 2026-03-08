

# **DuoSpace** — A Private Couples App

A minimal, elegant app designed exclusively for you and your girlfriend. Soft neutral tones (warm beige, off-white, subtle earth tones) — no cheesy romantic theme, just clean and premium.

## Backend & Auth
- **Lovable Cloud (Supabase)** for database, auth, storage, and edge functions
- Two hardcoded user accounts (you + her) with email/password login
- Biometric lock via Capacitor plugins for both iOS and Android

## Core Features

### 1. Chat & Messaging
- Real-time text messaging with read receipts and typing indicators
- Photo, video, and voice message sharing
- Disappearing messages option (Snapchat-style, configurable timer)
- Message reactions (emoji)
- Messages stored securely in the database

### 2. Shared Gallery
- "My Gallery" and "Her Gallery" sections
- Upload and view photos/videos in HD
- Shared album for photos you both save
- Photos stored in Supabase Storage

### 3. Video & Voice Calls
- HD video and voice calls using **Daily.co** (generous free tier, WebRTC-based)
- Adaptive bitrate — automatically adjusts quality based on network conditions
- Call history log
- Picture-in-picture support

### 4. Live Location & Distance
- Real-time location sharing on an interactive map (using Leaflet/OpenStreetMap — free)
- Live distance between you two, always visible
- Location history/breadcrumbs (optional toggle)

### 5. Special Features
- **Mood status** — set a quick emoji/status your partner sees
- **Shared countdown timers** — count down to your next date or event
- **"Thinking of you" tap** — a quick tap that sends a gentle notification
- **Memory wall** — pin favorite photos/moments to a shared board
- **Daily question** — a fun daily question prompt for both to answer
- **Streaks** — track how many consecutive days you've chatted

## Pages & Navigation
- Bottom tab navigation (5 tabs): **Chat**, **Gallery**, **Calls**, **Map**, **Us** (special features hub)
- Clean, card-based layouts with smooth animations
- App lock screen with biometric authentication on open

## Mobile (Capacitor)
- Capacitor setup for both iOS and Android
- Biometric auth plugin (`@capacitor-community/biometric-auth`)
- Geolocation plugin (`@capacitor/geolocation`)
- Camera plugin for quick photo capture
- Push notifications for messages and taps
- Haptic feedback for interactions

## Design System
- **Colors**: Warm beige (#F5F0EB), off-white (#FAFAF8), soft taupe (#C4B5A4), charcoal text (#2C2C2C)
- **Typography**: Clean sans-serif, generous spacing
- **Components**: Rounded cards, subtle shadows, smooth transitions
- **Both platforms**: Native-feeling on iPhone and Android

