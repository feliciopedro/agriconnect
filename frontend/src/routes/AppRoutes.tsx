import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Home } from '../pages/Home';
import { HealthStatus } from '../pages/HealthStatus';
import { Layout } from '../components/Layout';

export const AppRoutes: React.FC = () => {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/health" element={<HealthStatus />} />
      </Routes>
    </Layout>
  );
};
