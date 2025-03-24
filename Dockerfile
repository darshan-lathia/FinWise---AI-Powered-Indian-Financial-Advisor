FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend
COPY client-react/package*.json ./
RUN npm ci
COPY client-react/ ./
RUN npm run build

FROM python:3.9-slim

WORKDIR /app
COPY server-python/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server-python/ .
COPY --from=frontend-builder /app/frontend/dist /app/static

ENV PORT=9000
ENV GOOGLE_API_KEY=""
ENV ENV=production

EXPOSE 9000

CMD ["python", "app.py"] 