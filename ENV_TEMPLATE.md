# Environment Variables Template

Copy this to `.env` and fill in your values:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/kixi"

# JWT Secret (generate a random string)
JWT_SECRET="your-super-secret-jwt-key-change-this"

# Cloudinary Configuration
# Get these from https://cloudinary.com/console
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME="your_cloud_name"
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET="kixi_preset"
CLOUDINARY_API_KEY="your_api_key"
CLOUDINARY_API_SECRET="your_api_secret"

# Node Environment
NODE_ENV="development"
```

See `docs/CLOUDINARY_SETUP.md` for detailed Cloudinary setup instructions.
