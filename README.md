# Coaching Beyond Web / PWA

A fully responsive, mobile-first Web and Progressive Web App (PWA) version of the **Coaching Beyond** Cricket Academy Management app.

## Features
- **Same Backend & Data Structure**: Connects to the same Firebase Firestore backend (`coaching-beyond-academy`).
- **Authentication**: Master Admin login (`admin@coachingbeyond.in` / `Cb@123`) and Coach login / registration / PIN verification with admin approval workflow.
- **Dashboard & Analytics**: Real-time stats, session breakdown charts, hours coached, and player metrics.
- **Session Management**: Filter and manage coaching sessions by type (Batting, Bowling, Wicket Keeping, Fielding, Fitness, Technical Training, Match Preparation, Other), wicket type (Turf, Astro, Matting), date, and coach.
- **Player Management**: Add and manage academy players and view player session history.
- **Coach Management & Approval**: Approve/reject pending coach registrations (Admin only).
- **Excel / CSV Report Export**: Export coaching session summaries and stats.
- **PWA Support**: Fully installable on iOS Safari ("Add to Home Screen"), Android Chrome ("Install App"), and desktop browsers.

## How to Run Locally
1. Start a local static web server in the `web/` directory (e.g., using Python: `python -m http.server 8000` or Node `http-server`).
2. Open `http://localhost:8000` in your browser.
