import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../models/admin_models.dart';
import '../theme/admin_theme.dart';

class DashboardScreen extends StatefulWidget {
  final List<AdminUserModel> users;
  final List<AdminClipModel> clips;
  final List<AdminReportModel> reports;
  final List<AdminLiveModel> activeLives;
  final String searchQuery;

  const DashboardScreen({
    super.key,
    required this.users,
    required this.clips,
    required this.reports,
    required this.activeLives,
    required this.searchQuery,
  });

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  bool _useSimulatedWhenEmpty = true;

  @override
  Widget build(BuildContext context) {
    final hasLiveUsers = widget.users.isNotEmpty;
    final hasLiveClips = widget.clips.isNotEmpty;
    final hasLiveReports = widget.reports.isNotEmpty;
    final hasLiveStreams = widget.activeLives.isNotEmpty;

    final pendingReportsReal = widget.reports
        .where((r) => r.status == 'pending' || r.status.isEmpty)
        .length;

    final useSimulated = _useSimulatedWhenEmpty &&
        !hasLiveUsers &&
        !hasLiveClips &&
        !hasLiveReports &&
        !hasLiveStreams;

    final totalUsersCount = useSimulated ? 14820 : widget.users.length;
    final totalVideosCount = useSimulated ? 49310 : widget.clips.length;
    final pendingReportsCount = useSimulated ? 14 : pendingReportsReal;
    final activeLivesCount = useSimulated ? 28 : widget.activeLives.length;

    final query = widget.searchQuery.trim().toLowerCase();
    final latestUsers = widget.users.where((u) {
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
          Wrap(
            spacing: 12,
            runSpacing: 10,
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Dashboard General',
                    style: TextStyle(
                      color: AdminColors.textPrimary,
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Métricas clave y crecimiento de Viroklipz conectados a Firestore',
                    style: TextStyle(
                      color: AdminColors.textSecondary,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: AdminColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: useSimulated
                        ? AdminColors.magenta.withValues(alpha: 0.45)
                        : AdminColors.electricBlue.withValues(alpha: 0.45),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: useSimulated
                            ? AdminColors.magenta
                            : AdminColors.electricBlue,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      useSimulated
                          ? 'Datos simulados (Firestore listo)'
                          : 'Conectado en tiempo real a Firestore',
                      style: const TextStyle(
                        color: AdminColors.textPrimary,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (!hasLiveUsers && !hasLiveClips) ...[
                      const SizedBox(width: 10),
                      TextButton(
                        onPressed: () => setState(
                          () => _useSimulatedWhenEmpty = !_useSimulatedWhenEmpty,
                        ),
                        style: TextButton.styleFrom(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 2,
                          ),
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        child: Text(
                          _useSimulatedWhenEmpty ? 'Ver reales (0)' : 'Simular',
                          style: const TextStyle(
                            color: AdminColors.electricBlue,
                            fontSize: 11.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 22),

          // 1. Cuatro Tarjetas (Cards) Superiores
          LayoutBuilder(
            builder: (context, constraints) {
              final width = constraints.maxWidth;
              final columns = width >= 1100
                  ? 4
                  : width >= 660
                      ? 2
                      : 1;
              const spacing = 16.0;
              final cardWidth = (width - (columns - 1) * spacing) / columns;

              return Wrap(
                spacing: spacing,
                runSpacing: spacing,
                children: [
                  SizedBox(
                    width: cardWidth,
                    child: _KpiCard(
                      title: 'Total Usuarios',
                      value: _formatCompact(totalUsersCount),
                      subtitle: useSimulated
                          ? '+12.4% esta semana'
                          : '${widget.users.where((u) => !u.isBanned).length} cuentas activas',
                      icon: Icons.groups_rounded,
                      accentColor: AdminColors.electricBlue,
                    ),
                  ),
                  SizedBox(
                    width: cardWidth,
                    child: _KpiCard(
                      title: 'Videos Subidos',
                      value: _formatCompact(totalVideosCount),
                      subtitle: useSimulated
                          ? '384 videos subidos hoy'
                          : 'Colección clips en Firestore',
                      icon: Icons.video_library_rounded,
                      accentColor: AdminColors.magenta,
                    ),
                  ),
                  SizedBox(
                    width: cardWidth,
                    child: _KpiCard(
                      title: 'Reportes Pendientes',
                      value: '$pendingReportsCount',
                      subtitle: useSimulated
                          ? 'Cola de moderación prioritaria'
                          : '${widget.reports.length} reportes totales',
                      icon: Icons.flag_rounded,
                      accentColor: AdminColors.purple,
                    ),
                  ),
                  SizedBox(
                    width: cardWidth,
                    child: _KpiCard(
                      title: 'Lives Activos',
                      value: '$activeLivesCount',
                      subtitle: useSimulated
                          ? '1,940 espectadores conectados'
                          : '${widget.activeLives.fold<int>(0, (s, l) => s + l.viewerCount)} espectadores en vivo',
                      icon: Icons.sensors_rounded,
                      accentColor: AdminColors.electricBlue,
                    ),
                  ),
                ],
              );
            },
          ),

          const SizedBox(height: 22),

          // 2. Gráfico de líneas (fl_chart) de los últimos 7 días
          _UserGrowthLineChartCard(
            users: widget.users,
            useSimulatedData: useSimulated,
          ),

          const SizedBox(height: 22),

          // 3. Tabla de últimos usuarios registrados desde Firestore
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
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
                            'Últimos usuarios en Firestore',
                            style: TextStyle(
                              color: AdminColors.textPrimary,
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Registros recientes sincronizados desde la colección users',
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
                          '${latestUsers.length} registros',
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
                          'Aún no hay usuarios cargados desde Firestore.',
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
                                DataColumn(label: Text('Avatar')),
                                DataColumn(label: Text('Nombre')),
                                DataColumn(label: Text('Email')),
                                DataColumn(label: Text('Países')),
                                DataColumn(label: Text('Registro')),
                              ],
                              rows: latestUsers.map((user) {
                                return DataRow(
                                  cells: [
                                    DataCell(
                                      CircleAvatar(
                                        radius: 17,
                                        backgroundColor: AdminColors.magenta,
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
                                    DataCell(Text(user.country)),
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
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
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
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: accentColor.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: accentColor.withValues(alpha: 0.38),
                    ),
                  ),
                  child: Icon(icon, color: accentColor, size: 21),
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
      ),
    );
  }
}

class _UserGrowthLineChartCard extends StatelessWidget {
  final List<AdminUserModel> users;
  final bool useSimulatedData;

  const _UserGrowthLineChartCard({
    required this.users,
    required this.useSimulatedData,
  });

  static const List<int> _simulated7Days = [180, 245, 220, 310, 390, 460, 540];

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final days = List.generate(7, (idx) {
      return DateTime(now.year, now.month, now.day)
          .subtract(Duration(days: 6 - idx));
    });

    final counts = List<int>.filled(7, 0);
    if (useSimulatedData) {
      for (int i = 0; i < 7; i++) {
        counts[i] = _simulated7Days[i];
      }
    } else {
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
    }

    final maxCount = counts.reduce((a, b) => a > b ? a : b);
    final maxY = (maxCount < 5 ? 6 : (maxCount * 1.2).ceil()).toDouble();

    final spots = List.generate(
      7,
      (i) => FlSpot(i.toDouble(), counts[i].toDouble()),
    );

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(22),
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
                      'Crecimiento de Usuarios (Últimos 7 días)',
                      style: TextStyle(
                        color: AdminColors.textPrimary,
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Evolución diaria de nuevas cuentas registradas en Viroklipz',
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
                    gradient: LinearGradient(
                      colors: [
                        AdminColors.magenta.withValues(alpha: 0.2),
                        AdminColors.electricBlue.withValues(alpha: 0.2),
                      ],
                    ),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: AdminColors.electricBlue.withValues(alpha: 0.35),
                    ),
                  ),
                  child: const Text(
                    '7 Días',
                    style: TextStyle(
                      color: AdminColors.electricBlue,
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            SizedBox(
              height: 260,
              child: LineChart(
                LineChartData(
                  minX: 0,
                  maxX: 6,
                  minY: 0,
                  maxY: maxY,
                  lineTouchData: LineTouchData(
                    touchTooltipData: LineTouchTooltipData(
                      getTooltipItems: (touchedSpots) {
                        return touchedSpots.map((spot) {
                          final idx = spot.x.toInt();
                          final label = idx >= 0 && idx < days.length
                              ? _shortWeekday(days[idx].weekday)
                              : '';
                          return LineTooltipItem(
                            '$label: ${spot.y.toInt()} usuarios',
                            const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                              fontSize: 12,
                            ),
                          );
                        }).toList();
                      },
                    ),
                  ),
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
                        reservedSize: 40,
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
                                fontSize: 11.5,
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
                      barWidth: 3.5,
                      isStrokeCapRound: true,
                      gradient: const LinearGradient(
                        colors: [AdminColors.magenta, AdminColors.electricBlue],
                      ),
                      dotData: FlDotData(
                        show: true,
                        getDotPainter: (spot, percent, barData, index) =>
                            FlDotCirclePainter(
                          radius: 4,
                          color: AdminColors.electricBlue,
                          strokeWidth: 2,
                          strokeColor: AdminColors.magenta,
                        ),
                      ),
                      belowBarData: BarAreaData(
                        show: true,
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            AdminColors.magenta.withValues(alpha: 0.28),
                            AdminColors.electricBlue.withValues(alpha: 0.03),
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
      ),
    );
  }
}

String _formatCompact(int count) {
  if (count >= 1000) {
    final s = count.toString();
    final buffer = StringBuffer();
    for (int i = 0; i < s.length; i++) {
      final revIdx = s.length - i;
      if (i > 0 && revIdx % 3 == 0) buffer.write(',');
      buffer.write(s[i]);
    }
    return buffer.toString();
  }
  return '$count';
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
