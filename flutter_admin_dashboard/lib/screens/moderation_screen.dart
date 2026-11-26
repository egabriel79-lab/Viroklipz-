import 'package:flutter/material.dart';

import '../models/admin_models.dart';
import '../services/admin_firestore_service.dart';
import '../theme/admin_theme.dart';

class ModerationScreen extends StatefulWidget {
  final List<AdminReportModel> reports;
  final List<AdminClipModel> clips;
  final String searchQuery;

  const ModerationScreen({
    super.key,
    required this.reports,
    required this.clips,
    required this.searchQuery,
  });

  @override
  State<ModerationScreen> createState() => _ModerationScreenState();
}

class _ModerationScreenState extends State<ModerationScreen> {
  String? _busyReportId;

  Future<void> _ignoreReport(AdminReportModel report) async {
    setState(() => _busyReportId = report.id);
    try {
      await AdminFirestoreService.instance.ignoreReport(report.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Reporte ignorado y removido de la cola.'),
          backgroundColor: AdminColors.electricBlue,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error al ignorar reporte: $e'),
          backgroundColor: AdminColors.danger,
        ),
      );
    } finally {
      if (mounted) setState(() => _busyReportId = null);
    }
  }

  Future<void> _deleteVideoAndReport(AdminReportModel report) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AdminColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: const BorderSide(color: AdminColors.border),
        ),
        title: const Text(
          'Eliminar Video Reportado',
          style: TextStyle(color: AdminColors.textPrimary),
        ),
        content: Text(
          'Se eliminará el video (${report.effectiveVideoId}) y este reporte de Firestore. ¿Deseas continuar?',
          style: const TextStyle(
            color: AdminColors.textSecondary,
            fontSize: 13.5,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AdminColors.magenta,
              foregroundColor: Colors.white,
            ),
            child: const Text('Eliminar Video'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _busyReportId = report.id);
    try {
      await AdminFirestoreService.instance.deleteReportedVideoAndReport(report);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Video eliminado y reporte resuelto correctamente.'),
          backgroundColor: AdminColors.success,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('No se pudo eliminar el video: $e'),
          backgroundColor: AdminColors.danger,
        ),
      );
    } finally {
      if (mounted) setState(() => _busyReportId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final clipMap = {for (final c in widget.clips) c.id: c};
    final query = widget.searchQuery.trim().toLowerCase();

    final filteredReports = widget.reports.where((r) {
      if (query.isEmpty) return true;
      final clip = clipMap[r.effectiveVideoId];
      return r.reason.toLowerCase().contains(query) ||
          r.details.toLowerCase().contains(query) ||
          r.effectiveVideoId.toLowerCase().contains(query) ||
          (clip?.caption.toLowerCase().contains(query) ?? false) ||
          (clip?.authorUsername.toLowerCase().contains(query) ?? false);
    }).toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
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
                    'Moderación de Videos Reportados',
                    style: TextStyle(
                      color: AdminColors.textPrimary,
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Lectura en vivo de la colección reports en Firestore',
                    style: TextStyle(
                      color: AdminColors.textSecondary,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                decoration: BoxDecoration(
                  color: AdminColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: AdminColors.magenta.withValues(alpha: 0.4),
                  ),
                ),
                child: Text(
                  '${filteredReports.length} reportes',
                  style: const TextStyle(
                    color: AdminColors.magenta,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          if (filteredReports.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 56, horizontal: 24),
              decoration: BoxDecoration(
                color: AdminColors.surface,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: AdminColors.border),
              ),
              child: const Column(
                children: [
                  Icon(
                    Icons.verified_rounded,
                    color: AdminColors.electricBlue,
                    size: 42,
                  ),
                  SizedBox(height: 12),
                  Text(
                    'No hay videos reportados en cola',
                    style: TextStyle(
                      color: AdminColors.textPrimary,
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Todos los reportes de Firestore han sido atendidos.',
                    style: TextStyle(
                      color: AdminColors.textSecondary,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: filteredReports.length,
              separatorBuilder: (_, __) => const SizedBox(height: 14),
              itemBuilder: (context, index) {
                final report = filteredReports[index];
                final clip = clipMap[report.effectiveVideoId];
                final isBusy = _busyReportId == report.id;

                return Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: AdminColors.surface,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: AdminColors.border),
                  ),
                  child: LayoutBuilder(
                    builder: (context, cardConstraints) {
                      final isWideCard = cardConstraints.maxWidth >= 680;
                      final detailsWidget = Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              color:
                                  AdminColors.magenta.withValues(alpha: 0.14),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color:
                                    AdminColors.magenta.withValues(alpha: 0.45),
                              ),
                            ),
                            child: const Icon(
                              Icons.flag_rounded,
                              color: AdminColors.magenta,
                              size: 22,
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Wrap(
                                  spacing: 8,
                                  runSpacing: 6,
                                  crossAxisAlignment: WrapCrossAlignment.center,
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 9,
                                        vertical: 4,
                                      ),
                                      decoration: BoxDecoration(
                                        color: AdminColors.magenta
                                            .withValues(alpha: 0.16),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Text(
                                        'Motivo: ${_reasonLabel(report.reason)}',
                                        style: const TextStyle(
                                          color: Color(0xFFF9A8D4),
                                          fontSize: 11.5,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ),
                                    Text(
                                      'ID Video: ${report.effectiveVideoId}',
                                      style: const TextStyle(
                                        color: AdminColors.electricBlue,
                                        fontSize: 12,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    Text(
                                      '• ${_formatDateTime(report.createdAt)}',
                                      style: const TextStyle(
                                        color: AdminColors.textMuted,
                                        fontSize: 12,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 10),
                                if (clip != null) ...[
                                  Text(
                                    'Creador: @${clip.authorUsername} (${clip.authorDisplayName})',
                                    style: const TextStyle(
                                      color: AdminColors.textPrimary,
                                      fontSize: 13.5,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    clip.caption.isNotEmpty
                                        ? clip.caption
                                        : 'Video sin descripción',
                                    style: const TextStyle(
                                      color: AdminColors.textSecondary,
                                      fontSize: 13,
                                    ),
                                  ),
                                ] else
                                  Text(
                                    'Autor objetivo: ${report.targetAuthorId}',
                                    style: const TextStyle(
                                      color: AdminColors.textSecondary,
                                      fontSize: 13,
                                    ),
                                  ),
                                if (report.details.isNotEmpty) ...[
                                  const SizedBox(height: 8),
                                  Container(
                                    padding: const EdgeInsets.all(10),
                                    decoration: BoxDecoration(
                                      color: AdminColors.background,
                                      borderRadius: BorderRadius.circular(10),
                                      border:
                                          Border.all(color: AdminColors.border),
                                    ),
                                    child: Text(
                                      'Detalle: ${report.details}',
                                      style: const TextStyle(
                                        color: AdminColors.textSecondary,
                                        fontSize: 12.5,
                                      ),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ],
                      );

                      final ignoreButton = OutlinedButton.icon(
                        onPressed: isBusy ? null : () => _ignoreReport(report),
                        icon: const Icon(Icons.close_rounded, size: 16),
                        label: const Text('Ignorar Reporte'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AdminColors.electricBlue,
                          side: BorderSide(
                            color: AdminColors.electricBlue
                                .withValues(alpha: 0.45),
                          ),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 12,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(11),
                          ),
                        ),
                      );

                      final deleteButton = ElevatedButton.icon(
                        onPressed: isBusy
                            ? null
                            : () => _deleteVideoAndReport(report),
                        icon: const Icon(
                          Icons.delete_forever_rounded,
                          size: 16,
                        ),
                        label: const Text('Eliminar Video'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AdminColors.magenta,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 12,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(11),
                          ),
                        ),
                      );

                      if (isWideCard) {
                        return Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(child: detailsWidget),
                            const SizedBox(width: 16),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                ignoreButton,
                                const SizedBox(height: 10),
                                deleteButton,
                              ],
                            ),
                          ],
                        );
                      }

                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          detailsWidget,
                          const SizedBox(height: 14),
                          Wrap(
                            spacing: 10,
                            runSpacing: 10,
                            children: [
                              ignoreButton,
                              deleteButton,
                            ],
                          ),
                        ],
                      );
                    },
                  ),
                );
              },
            ),
        ],
      ),
    );
  }
}

String _reasonLabel(String reason) {
  switch (reason) {
    case 'spam':
      return 'Spam o fraude';
    case 'acoso':
      return 'Acoso';
    case 'contenido_inapropiado':
      return 'Contenido inapropiado';
    case 'desnudo':
      return 'Desnudos o sexual';
    case 'derechos_autor':
      return 'Derechos de autor';
    default:
      return reason;
  }
}

String _formatDateTime(DateTime dt) {
  final d = dt.day.toString().padLeft(2, '0');
  final m = dt.month.toString().padLeft(2, '0');
  final h = dt.hour.toString().padLeft(2, '0');
  final min = dt.minute.toString().padLeft(2, '0');
  return '$d/$m/${dt.year} $h:$min';
}
