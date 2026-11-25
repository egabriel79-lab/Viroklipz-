import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../models/admin_models.dart';
import '../theme/admin_theme.dart';

class DashboardScreen extends StatelessWidget {
  final List<AdminUserModel> users;
  final List<AdminClipModel> clips;
  final List<AdminLiveModel> activeLives;
  final String searchQuery;

  const DashboardScreen({
    super.key,
    required this.users,
    required this.clips,
    required this.activeLives,
    required this.searchQuery,
  });

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final todayStart = DateTime(now.year, now.month, now.day);

    final totalUsers = users.length;
    final totalCoins = users.fold<int>(0, (acc, u) => acc + u.coins);
    final totalLiveGifts = activeLives.fold<int>(0, (acc, l) => acc + l.giftsCount);
    final estimatedRevenueUsd = (totalCoins * 0.015) + (totalLiveGifts * 1.25);

    final videosUploadedToday = clips
        .where((c) => !c.createdAt.isBefore(todayStart))
        .length;
    final liveCount = activeLives.length;

    final query = searchQuery.trim().toLowerCase();
    final latestUsers = users.where((u) {
      if (query.isEmpty) return true;
      return u.displayName.toLowerCase().contains(query) ||
          u.username.toLowerCase().contains(query) ||
          u.email.toLowerCase().contains(query) ||
          u.country.toLowerCase().contains(query);
    }).take(8).toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Resumen General',
            style: TextStyle(
              color: AdminColors.textPrimary,
              fontSize: 22,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Métricas globales de Viroklipz sincronizadas en tiempo real con Firestore',
            style: TextStyle(color: AdminColors.textSecondary, fontSize: 13),
          ),
          const SizedBox(height: 22),

          // 1. KPI Summary Cards
          LayoutBuilder(
            builder: (context, constraints) {
              final width = constraints.maxWidth;
              final columns = width >= 1100
                  ? 4
                  : width >= 660
                      ? 2
                      : 1;
              final spacing = 16.0;
              final cardWidth = (width - (columns - 1) * spacing) / columns;

              return Wrap(
                spacing: spacing,
                runSpacing: spacing,
                children: [
                  SizedBox(
                    width: cardWidth,
                    child: _KpiCard(
                      title: 'Total de usuarios',
                      value: '$totalUsers',
                      subtitle: '${users.where((u) => !u.banned).length} cuentas activas',
                      icon: Icons.groups_rounded,
                      accentColor: AdminColors.electricBlue,
                    ),
                  ),
                  SizedBox(
                    width: cardWidth,
                    child: _KpiCard(
                      title: 'Ingresos por monedas',
                      value: '\$${estimatedRevenueUsd.toStringAsFixed(2)}',
                      subtitle: '$totalCoins monedas en circulación',
                      icon: Icons.monetization_on_rounded,
                      accentColor: AdminColors.purple,
                    ),
                  ),
                  SizedBox(
                    width: cardWidth,
                    child: _KpiCard(
                      title: 'Videos subidos hoy',
                      value: '$videosUploadedToday',
                      subtitle: '${clips.length} videos totales',
                      icon: Icons.video_library_rounded,
                      accentColor: AdminColors.royalBlue,
                    ),
                  ),
                  SizedBox(
                    width: cardWidth,
                    child: _KpiCard(
                      title: 'Lives activos',
                      value: '$liveCount',
                      subtitle:
                          '${activeLives.fold<int>(0, (s, l) => s + l.viewerCount)} espectadores en vivo',
                      icon: Icons.sensors_rounded,
                      accentColor: AdminColors.magenta,
                    ),
                  ),
                ],
              );
            },
          ),

          const SizedBox(height: 22),

          // 2. Charts Row (fl_chart LineChart + PieChart)
          LayoutBuilder(
            builder: (context, constraints) {
              final isTwoColumn = constraints.maxWidth >= 960;
              if (isTwoColumn) {
                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      flex: 6,
                      child: _UserGrowthLineChartCard(users: users),
                    ),
                    const SizedBox(width: 18),
                    Expanded(
                      flex: 4,
                      child: _TopCountriesPieChartCard(users: users),
                    ),
                  ],
                );
              }
              return Column(
                children: [
                  _UserGrowthLineChartCard(users: users),
                  const SizedBox(height: 18),
                  _TopCountriesPieChartCard(users: users),
                ],
              );
            },
          ),

          const SizedBox(height: 22),

          // 3. Latest Registered Users Table
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AdminColors.surface,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AdminColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Últimos usuarios registrados',
                          style: TextStyle(
                            color: AdminColors.textPrimary,
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'Cuentas más recientes ordenadas por fecha de creación',
                          style: TextStyle(
                            color: AdminColors.textSecondary,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: AdminColors.surfaceElevated,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AdminColors.border),
                      ),
                      child: Text(
                        'Mostrando ${latestUsers.length}',
                        style: const TextStyle(
                          color: AdminColors.electricBlue,
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                if (latestUsers.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 28),
                    child: Center(
                      child: Text(
                        'No se encontraron usuarios registrados.',
                        style: TextStyle(color: AdminColors.textMuted),
                      ),
                    ),
                  )
                else
                  LayoutBuilder(
                    builder: (context, tableConstraints) {
                      return SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: ConstrainedBox(
                          constraints: BoxConstraints(
                            minWidth: tableConstraints.maxWidth,
                          ),
                          child: DataTable(
                            columnSpacing: 24,
                            horizontalMargin: 14,
                            columns: const [
                              DataColumn(label: Text('Foto')),
                              DataColumn(label: Text('Nombre')),
                              DataColumn(label: Text('Correo')),
                              DataColumn(label: Text('País')),
                              DataColumn(label: Text('Fecha de registro')),
                            ],
                            rows: latestUsers.map((user) {
                              return DataRow(
                                cells: [
                                  DataCell(
                                    CircleAvatar(
                                      radius: 17,
                                      backgroundColor: AdminColors.purple,
                                      backgroundImage:
                                          user.avatarUrl.startsWith('http')
                                              ? NetworkImage(user.avatarUrl)
                                              : null,
                                      child: user.avatarUrl.startsWith('http')
                                          ? null
                                          : Text(
                                              user.displayName.isNotEmpty
                                                  ? user.displayName[0]
                                                      .toUpperCase()
                                                  : 'U',
                                              style: const TextStyle(
                                                color: Colors.white,
                                                fontWeight: FontWeight.w700,
                                                fontSize: 12,
                                              ),
                                            ),
                                    ),
                                  ),
                                  DataCell(
                                    Column(
                                      mainAxisAlignment:
                                          MainAxisAlignment.center,
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          user.displayName,
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                            color: AdminColors.textPrimary,
                                          ),
                                        ),
                                        Text(
                                          '@${user.username}',
                                          style: const TextStyle(
                                            fontSize: 11.5,
                                            color: AdminColors.textMuted,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  DataCell(Text(user.email)),
                                  DataCell(
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 10,
                                        vertical: 4,
                                      ),
                                      decoration: BoxDecoration(
                                        color: AdminColors.surfaceElevated,
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Text(
                                        user.country,
                                        style: const TextStyle(
                                          fontSize: 12,
                                          color: AdminColors.textSecondary,
                                        ),
                                      ),
                                    ),
                                  ),
                                  DataCell(
                                    Text(
                                      _formatDate(user.createdAt),
                                      style: const TextStyle(
                                        color: AdminColors.textSecondary,
                                      ),
                                    ),
                                  ),
                                ],
                              );
                            }).toList(),
                          ),
                        ),
                      );
                    },
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _KpiCard extends StatelessWidget {
  final String title;
  final String value;
  final String subtitle;
  final IconData icon;
  final Color accentColor;

  const _KpiCard({
    required this.title,
    required this.value,
    required this.subtitle,
    required this.icon,
    required this.accentColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AdminColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AdminColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    color: AdminColors.textSecondary,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: accentColor.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: accentColor.withValues(alpha: 0.35)),
                ),
                child: Icon(icon, color: accentColor, size: 20),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            value,
            style: const TextStyle(
              color: AdminColors.textPrimary,
              fontSize: 28,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            subtitle,
            style: const TextStyle(
              color: AdminColors.textMuted,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

class _UserGrowthLineChartCard extends StatelessWidget {
  final List<AdminUserModel> users;

  const _UserGrowthLineChartCard({required this.users});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final days = List.generate(7, (idx) {
      final date = DateTime(now.year, now.month, now.day)
          .subtract(Duration(days: 6 - idx));
      return date;
    });

    final counts = List<int>.filled(7, 0);
    for (final user in users) {
      final createdDay = DateTime(
        user.createdAt.year,
        user.createdAt.month,
        user.createdAt.day,
      );
      for (int i = 0; i < 7; i++) {
        if (createdDay == days[i]) {
          counts[i]++;
          break;
        }
      }
    }

    final maxCount = counts.reduce((a, b) => a > b ? a : b);
    final maxY = (maxCount < 4 ? 5 : maxCount + 2).toDouble();

    final spots = List.generate(
      7,
      (i) => FlSpot(i.toDouble(), counts[i].toDouble()),
    );

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AdminColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AdminColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Crecimiento de usuarios (Últimos 7 días)',
            style: TextStyle(
              color: AdminColors.textPrimary,
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Registros diarios en la plataforma Viroklipz',
            style: TextStyle(color: AdminColors.textSecondary, fontSize: 12),
          ),
          const SizedBox(height: 24),
          SizedBox(
            height: 240,
            child: LineChart(
              LineChartData(
                minX: 0,
                maxX: 6,
                minY: 0,
                maxY: maxY,
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  getDrawingHorizontalLine: (_) => const FlLine(
                    color: AdminColors.border,
                    strokeWidth: 1,
                  ),
                ),
                borderData: FlBorderData(show: false),
                titlesData: FlTitlesData(
                  topTitles: const AxisTitles(
                    sideTitles: SideTitles(showTitles: false),
                  ),
                  rightTitles: const AxisTitles(
                    sideTitles: SideTitles(showTitles: false),
                  ),
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 34,
                      interval: maxY > 10 ? (maxY / 4).ceilToDouble() : 1,
                      getTitlesWidget: (value, meta) => Text(
                        value.toInt().toString(),
                        style: const TextStyle(
                          color: AdminColors.textMuted,
                          fontSize: 11,
                        ),
                      ),
                    ),
                  ),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 28,
                      interval: 1,
                      getTitlesWidget: (value, meta) {
                        final idx = value.toInt();
                        if (idx < 0 || idx >= days.length) {
                          return const SizedBox.shrink();
                        }
                        return Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            _shortWeekday(days[idx].weekday),
                            style: const TextStyle(
                              color: AdminColors.textSecondary,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ),
                lineBarsData: [
                  LineChartBarData(
                    spots: spots,
                    isCurved: true,
                    barWidth: 3.2,
                    isStrokeCapRound: true,
                    gradient: const LinearGradient(
                      colors: [AdminColors.electricBlue, AdminColors.purple],
                    ),
                    dotData: const FlDotData(show: true),
                    belowBarData: BarAreaData(
                      show: true,
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          AdminColors.electricBlue.withValues(alpha: 0.28),
                          AdminColors.purple.withValues(alpha: 0.02),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TopCountriesPieChartCard extends StatelessWidget {
  final List<AdminUserModel> users;

  const _TopCountriesPieChartCard({required this.users});

  static const List<Color> _palette = [
    AdminColors.electricBlue,
    AdminColors.purple,
    AdminColors.royalBlue,
    AdminColors.magenta,
    AdminColors.success,
  ];

  @override
  Widget build(BuildContext context) {
    final Map<String, int> countryCounts = {};
    for (final u in users) {
      final key = u.country.trim().isNotEmpty ? u.country.trim() : 'Sin especificar';
      countryCounts[key] = (countryCounts[key] ?? 0) + 1;
    }

    final sortedEntries = countryCounts.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    final top5 = sortedEntries.isNotEmpty
        ? sortedEntries.take(5).toList()
        : const [
            MapEntry('Venezuela', 1),
            MapEntry('Colombia', 1),
            MapEntry('México', 1),
            MapEntry('España', 1),
            MapEntry('Argentina', 1),
          ];

    final total = top5.fold<int>(0, (acc, e) => acc + e.value);

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AdminColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AdminColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Top 5 Países',
            style: TextStyle(
              color: AdminColors.textPrimary,
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Distribución geográfica de usuarios activos',
            style: TextStyle(color: AdminColors.textSecondary, fontSize: 12),
          ),
          const SizedBox(height: 20),
          SizedBox(
            height: 185,
            child: PieChart(
              PieChartData(
                sectionsSpace: 3,
                centerSpaceRadius: 42,
                sections: List.generate(top5.length, (index) {
                  final entry = top5[index];
                  final pct = total > 0 ? (entry.value / total) * 100 : 0.0;
                  return PieChartSectionData(
                    value: entry.value.toDouble(),
                    color: _palette[index % _palette.length],
                    radius: 46,
                    title: '${pct.toStringAsFixed(0)}%',
                    titleStyle: const TextStyle(
                      color: Colors.white,
                      fontSize: 11.5,
                      fontWeight: FontWeight.w800,
                    ),
                  );
                }),
              ),
            ),
          ),
          const SizedBox(height: 16),
          ...List.generate(top5.length, (index) {
            final entry = top5[index];
            final color = _palette[index % _palette.length];
            final pct = total > 0 ? (entry.value / total) * 100 : 0.0;
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: color,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      entry.key,
                      style: const TextStyle(
                        color: AdminColors.textPrimary,
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  Text(
                    '${entry.value} (${pct.toStringAsFixed(1)}%)',
                    style: const TextStyle(
                      color: AdminColors.textSecondary,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}

String _shortWeekday(int weekday) {
  switch (weekday) {
    case DateTime.monday:
      return 'Lun';
    case DateTime.tuesday:
      return 'Mar';
    case DateTime.wednesday:
      return 'Mié';
    case DateTime.thursday:
      return 'Jue';
    case DateTime.friday:
      return 'Vie';
    case DateTime.saturday:
      return 'Sáb';
    case DateTime.sunday:
      return 'Dom';
    default:
      return '';
  }
}

String _formatDate(DateTime date) {
  final d = date.day.toString().padLeft(2, '0');
  final m = date.month.toString().padLeft(2, '0');
  final y = date.year.toString();
  return '$d/$m/$y';
}
