# Environment Variables Template

Copy this to `.env` and fill in your values:

```env
# Database (Prisma - legacy, pode ser removido se não usar)
DATABASE_URL="postgresql://user:password@localhost:5432/kixi"

# Backend API URL (Java Spring Boot backend)
BACKEND_API_URL="http://localhost:8080/api/v1"

# Backend Auth URL (login endpoint)
BACKEND_AUTH_URL="http://localhost:8080/api/v1/auth/login"

# JWT Secret (DEVE ser o mesmo do backend app.jwt.secret)
JWT_SECRET="your-super-secret-jwt-key-change-in-production"

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

## Student app (`student/`) and manager

```env
# URL do manager (para onde o login do aluno envia contas ADMIN). Mesmo cookie `auth_token` => sessão única.
NEXT_PUBLIC_MANAGER_URL="http://localhost:3002/manager"
```

`BACKEND_API_URL` é lido pelo manager **e** pelo `student/` (login e cadastro: `/auth/login`, `/auth/register`).
O cadastro precisa do endpoint `POST /api/v1/auth/register` (PR creative-mode/kixi#96).

## Testar sem o backend Java

```bash
node scripts/mock-api.mjs                 # imita o backend em :8080 (admin / Kixi1234!)
npm run dev                               # manager em :3002/manager
npm --prefix student run dev              # aluno em :3003
```

Contas do mock: `admin`, `professor`, `12345` (todas com `Kixi1234!`). O cadastro cria alunos novos em memória.
