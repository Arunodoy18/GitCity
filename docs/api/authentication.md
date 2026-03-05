# Authentication

GitCity uses GitHub OAuth for authentication and JWT tokens for session management.

## OAuth Flow

### 1. Redirect to GitHub

```
GET /auth/github
```

Redirects the user to GitHub's OAuth authorization page.

**Scopes requested:** `read:user`, `user:email`

### 2. GitHub Callback

```
GET /auth/github/callback?code=AUTHORIZATION_CODE
```

GitHub redirects here after authorization. The backend:
1. Exchanges the code for an access token
2. Fetches the user's GitHub profile
3. Creates or updates the user in the database
4. Generates a JWT token
5. Redirects to `FRONTEND_URL?token=JWT_TOKEN`

### 3. Using the Token

Include the JWT in all authenticated requests:

```
Authorization: Bearer <token>
```

Or it can be sent as an httpOnly cookie (`gitcity_token`).

## Endpoints

### GET /auth/me

Returns the current authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "id": 1,
  "githubId": 123456,
  "username": "arunodoy",
  "displayName": "Arunoday Singh",
  "avatarUrl": "https://avatars.githubusercontent.com/u/123456",
  "bio": "Building things"
}
```

### POST /auth/logout

Clears the session and cookie.

**Response:**
```json
{
  "message": "Logged out"
}
```

## Token Details

- **Algorithm:** HS256
- **Expiry:** 7 days
- **Payload:** `{ id, username, githubId }`
