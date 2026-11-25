import 'package:flutter/material.dart';

import '../firebase_options.dart';
import '../models/admin_models.dart';
import '../theme/admin_theme.dart';

class FinanceScreen extends StatelessWidget {
  final List<AdminUserModel> users;
  final List<AdminLiveModel> activeLives;

  const FinanceScreen({
    super.key,
    required this.users,
    required this.activeLives,
  });

  @override
  Widget build(BuildContext context) {
    final totalCoins = users.fold<int>(0, (acc, u) => acc + u.coins);
    final totalGifts = activeLives.fold<int>(0, (acc, l) => acc + l.giftsCount);
    final grossUsd = (totalCoins * 0.015) + (totalGifts * 1.25);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Finanzas y Monedas',
            style: TextStyle(
              color: AdminColors.textPrimary,
              fontSize: 22,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Balance estimado por ventas de monedas y regalos en vivo',
            style: TextStyle(color: AdminColors.textSecondary, fontSize: 13),
          ),
          const SizedBox(height: 20),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: AdminColors.surface,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AdminColors.border),
            ),
            child: Wrap(
              spacing: 32,
              runSpacing: 18,
              children: [
                _FinanceMetric(
                  label: 'Ingresos estimados (USD)',
                  value: '\$${grossUsd.toStringAsFixed(2)}',
                  color: AdminColors.electricBlue,
                ),
                _FinanceMetric(
                  label: 'Monedas en billeteras',
                  value: '$totalCoins',
                  color: AdminColors.warning,
                ),
                _FinanceMetric(
                  label: 'Regalos en Lives activos',
                  value: '$totalGifts',
                  color: AdminColors.purple,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _FinanceMetric extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _FinanceMetric({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(color: AdminColors.textSecondary, fontSize: 12.5),
        ),
        const SizedBox(height: 6),
        Text(
          value,
          style: TextStyle(
            color: color,
            fontSize: 28,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    );
  }
}

class AdminSettingsScreen extends StatelessWidget {
  final AdminUserModel adminUser;

  const AdminSettingsScreen({super.key, required this.adminUser});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Ajustes de Consola',
            style: TextStyle(
              color: AdminColors.textPrimary,
              fontSize: 22,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Información de conexión con Firebase y perfil del administrador actual',
            style: TextStyle(color: AdminColors.textSecondary, fontSize: 13),
          ),
          const SizedBox(height: 20),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              color: AdminColors.surface,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AdminColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _SettingLine(label: 'Proyecto Firebase', value: DefaultFirebaseOptions.web.projectId),
                _SettingLine(label: 'Database ID', value: DefaultFirebaseOptions.firestoreDatabaseId),
                _SettingLine(label: 'Admin UID', value: adminUser.uid),
                _SettingLine(label: 'Correo Admin', value: adminUser.email),
                _SettingLine(label: 'Rol en Firestore', value: adminUser.isAdmin ? 'isAdmin: true' : 'Sin rol'),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SettingLine extends StatelessWidget {
  final String label;
  final String value;
  const _SettingLine({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          SizedBox(
            width: 170,
            child: Text(
              label,
              style: const TextStyle(
                color: AdminColors.textMuted,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Expanded(
            child: SelectableText(
              value,
              style: const TextStyle(
                color: AdminColors.textPrimary,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
