# Restaurant Merchant Portal

Portal quản lý dành cho nhà hàng, được xây dựng với React + TypeScript + Vite.

## Mục đích

Ứng dụng này phục vụ cho việc quản lý nhà hàng, bao gồm:
- Quản lý menu và sản phẩm
- Quản lý đơn hàng
- Quản lý thông tin nhà hàng
- Xem thống kê và báo cáo

## Công nghệ sử dụng

- React + TypeScript
- Vite (Build tool)
- TailwindCSS
- Radix UI Components

## Cài đặt và chạy

### Development

```bash
# Cài đặt dependencies
npm install

# Chạy development server
npm run dev
```

### Production Build

```bash
# Build ứng dụng
npm run build

# Preview production build
npm run preview
```

### Docker

```bash
# Build Docker image
docker build -t restaurant-merchant .

# Run container
docker run -p 80:80 restaurant-merchant
```

## Cấu hình

Cấu hình API URL trong file `.env`:
- `.env.development` - cho môi trường development local
- `.env.production` - cho môi trường production/Docker

## Khác biệt với cnpm-fooddelivery

- **cnpm-fooddelivery**: Dành cho khách hàng đặt món
- **restaurant-merchant**: Dành cho nhà hàng quản lý đơn hàng và menu

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

