import 'package:flutter/material.dart';

import '../models/admin_models.dart';
import '../services/admin_firestore_service.dart';
import '../theme/admin_theme.dart';

class UserManagementScreen extends StatefulWidget {
  final List<AdminUserModel> users;
  final String searchQuery;

  const UserManagementScreen({
    super.key,
    required this.users,
    required this.searchQuery,
  });

  @override
  State<UserManagementScreen> createState() => _UserManagementScreenState();
}

class _UserManagementScreenState extends State<UserManagementScreen> {
  String _statusFilter = 'all';
  String? _busyUid;

  Future<void> _handleToggleBan(AdminUserModel user) async {
    final targetBanned = !user.isBanned;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AdminColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: const BorderSide(color: AdminColors.border),
        ),
        title: Text(
          targetBanned ? 'Suspender usuario' : 'Reactivar usuario',
          style: const TextStyle(color: AdminColors.textPrimary),
        ),
        content: Text(
          targetBanned
              ? '¿Confirmas suspender a @${user.username}? Se actualizará isBanned: true en Firestore.'
              : '¿Confirmas reactivar a @${user.username}? Se actualizará isBanned: false en Firestore.',
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
              backgroundColor:
                  targetBanned ? AdminColors.magenta : AdminColors.electricBlue,
              foregroundColor: Colors.white,
            ),
            child: Text(targetBanned ? 'Suspender' : 'Reactivar'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _busyUid = user.uid);
    try {
      await AdminFirestoreService.instance.setUserBanned(
        uid: user.uid,
        isBanned: targetBanned,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            targetBanned
                ? 'Usuario @${user.username} suspendido (isBanned: true).'
                : 'Usuario @${user.username} reactivado.',
          ),
          backgroundColor:
              targetBanned ? AdminColors.magenta : AdminColors.success,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error al actualizar usuario: $e'),
          backgroundColor: AdminColors.danger,
        ),
      );
    } finally {
      if (mounted) setState(() => _busyUid = null);
    }
  }

  Future<void> _handleVerifyUser(AdminUserModel user) async {
    if (user.isVerified) {
      final confirmRevoke = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: AdminColors.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
            side: const BorderSide(color: AdminColors.border),
          ),
          title: const Text(
            'Quitar verificación manual',
            style: TextStyle(color: AdminColors.textPrimary),
          ),
          content: Text(
            '¿Confirmas quitar isVerified: true a @${user.username}?${user.followersCount >= 10000 ? ' Seguirá mostrando la insignia por tener 10,000+ seguidores.' : ''}',
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
              child: const Text('Quitar'),
            ),
          ],
        ),
      );
      if (confirmRevoke != true) return;
    }

    final targetVerified = !user.isVerified;
    setState(() => _busyUid = user.uid);
    try {
      await AdminFirestoreService.instance.setUserVerified(
        uid: user.uid,
        isVerified: targetVerified,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            targetVerified
                ? 'Cuenta @${user.username} verificada (isVerified: true).'
                : 'Verificación manual removida de @${user.username}.',
          ),
          backgroundColor:
              targetVerified ? AdminColors.electricBlue : AdminColors.magenta,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error al actualizar verificación: $e'),
          backgroundColor: AdminColors.danger,
        ),
      );
    } finally {
      if (mounted) setState(() => _busyUid = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final query = widget.searchQuery.trim().toLowerCase();
    final filteredUsers = widget.users.where((u) {
      if (_statusFilter == 'active' && u.isBanned) return false;
      if (_statusFilter == 'banned' && !u.isBanned) return false;
      if (_statusFilter == 'verified' && !u.hasVerifiedBadge) return false;
      if (query.isEmpty) return true;
      return u.displayName.toLowerCase().contains(query) ||
          u.username.toLowerCase().contains(query) ||
          u.email.toLowerCase().contains(query) ||
          u.country.toLowerCase().contains(query) ||
          u.uid.toLowerCase().contains(query);
    }).toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 16,
            runSpacing: 12,
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Gestión de Usuarios',
                    style: TextStyle(
                      color: AdminColors.textPrimary,
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Lista en tiempo real desde la colección users de Firestore',
                    style: TextStyle(
                      color: AdminColors.textSecondary,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'all', label: Text('Todos')),
                  ButtonSegment(value: 'active', label: Text('Activos')),
                  ButtonSegment(value: 'verified', label: Text('Verificados')),
                  ButtonSegment(value: 'banned', label: Text('Suspendidos')),
                ],
                selected: {_statusFilter},
                onSelectionChanged: (val) {
                  setState(() => _statusFilter = val.first);
                },
              ),
            ],
          ),
          const SizedBox(height: 20),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AdminColors.surface,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AdminColors.border),
            ),
            child: filteredUsers.isEmpty
                ? const Padding(
                    padding: EdgeInsets.symmetric(vertical: 42),
                    child: Center(
                      child: Text(
                        'No hay usuarios que coincidan con el filtro actual.',
                        style: TextStyle(color: AdminColors.textMuted),
                      ),
                    ),
                  )
                : LayoutBuilder(
                    builder: (context, constraints) {
                      return SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: ConstrainedBox(
                          constraints: BoxConstraints(
                            minWidth: constraints.maxWidth,
                          ),
                          child: DataTable(
                            columnSpacing: 22,
                            dataRowMinHeight: 58,
                            dataRowMaxHeight: 68,
                            columns: const [
                              DataColumn(label: Text('Avatar')),
                              DataColumn(label: Text('Nombre')),
                              DataColumn(label: Text('Email')),
                              DataColumn(label: Text('Países')),
                              DataColumn(label: Text('Verificado')),
                              DataColumn(label: Text('Estado')),
                              DataColumn(label: Text('Acciones')),
                            ],
                            rows: filteredUsers.map((user) {
                              final isBusy = _busyUid == user.uid;
                              return DataRow(
                                cells: [
                                  DataCell(
                                    CircleAvatar(
                                      radius: 18,
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
                                                fontWeight: FontWeight.w800,
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
                                        Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Text(
                                              user.displayName,
                                              style: const TextStyle(
                                                color: AdminColors.textPrimary,
                                                fontWeight: FontWeight.w700,
                                              ),
                                            ),
                                            if (user.hasVerifiedBadge) ...[
                                              const SizedBox(width: 5),
                                              const Icon(
                                                Icons.verified,
                                                size: 16,
                                                color: AdminColors.electricBlue,
                                              ),
                                            ],
                                          ],
                                        ),
                                        Text(
                                          '@${user.username}',
                                          style: const TextStyle(
                                            color: AdminColors.textMuted,
                                            fontSize: 11.5,
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
                                        vertical: 5,
                                      ),
                                      decoration: BoxDecoration(
                                        color: AdminColors.surfaceElevated,
                                        borderRadius: BorderRadius.circular(8),
                                        border: Border.all(
                                          color: AdminColors.border,
                                        ),
                                      ),
                                      child: Text(
                                        user.country,
                                        style: const TextStyle(
                                          color: AdminColors.electricBlue,
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ),
                                  ),
                                  DataCell(
                                    _VerifiedBadgeCell(user: user),
                                  ),
                                  DataCell(
                                    _StatusBadge(isBanned: user.isBanned),
                                  ),
                                  DataCell(
                                    Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        ElevatedButton.icon(
                                          onPressed: isBusy
                                              ? null
                                              : () => _handleVerifyUser(user),
                                          icon: Icon(
                                            user.isVerified
                                                ? Icons.verified
                                                : Icons.verified_outlined,
                                            size: 16,
                                          ),
                                          label: Text(
                                            user.isVerified
                                                ? 'Verificado'
                                                : 'Verificar',
                                          ),
                                          style: ElevatedButton.styleFrom(
                                            backgroundColor: user.isVerified
                                                ? AdminColors.success
                                                    .withValues(alpha: 0.18)
                                                : AdminColors.electricBlue,
                                            foregroundColor: user.isVerified
                                                ? AdminColors.success
                                                : Colors.white,
                                            elevation: 0,
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 12,
                                              vertical: 11,
                                            ),
                                            side: user.isVerified
                                                ? BorderSide(
                                                    color: AdminColors.success
                                                        .withValues(alpha: 0.5),
                                                  )
                                                : BorderSide.none,
                                            shape: RoundedRectangleBorder(
                                              borderRadius:
                                                  BorderRadius.circular(11),
                                            ),
                                            textStyle: const TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        ElevatedButton.icon(
                                          onPressed: isBusy
                                              ? null
                                              : () => _handleToggleBan(user),
                                          icon: Icon(
                                            user.isBanned
                                                ? Icons
                                                    .check_circle_outline_rounded
                                                : Icons.block_rounded,
                                            size: 16,
                                          ),
                                          label: Text(
                                            user.isBanned
                                                ? 'Reactivar'
                                                : 'Suspender',
                                          ),
                                          style: ElevatedButton.styleFrom(
                                            backgroundColor: user.isBanned
                                                ? AdminColors.electricBlue
                                                : AdminColors.magenta,
                                            foregroundColor: Colors.white,
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 14,
                                              vertical: 11,
                                            ),
                                            shape: RoundedRectangleBorder(
                                              borderRadius:
                                                  BorderRadius.circular(11),
                                            ),
                                            textStyle: const TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                        ),
                                      ],
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
          ),
        ],
      ),
    );
  }
}

class _VerifiedBadgeCell extends StatelessWidget {
  final AdminUserModel user;
  const _VerifiedBadgeCell({required this.user});

  @override
  Widget build(BuildContext context) {
    final verified = user.hasVerifiedBadge;
    final color = verified ? AdminColors.electricBlue : AdminColors.textMuted;
    final label = user.isVerified
        ? 'Verificado'
        : (user.followersCount >= 10000 ? 'Auto (10K+)' : 'No');

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: verified ? 0.16 : 0.08),
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: color.withValues(alpha: verified ? 0.55 : 0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            verified ? Icons.verified : Icons.radio_button_unchecked_rounded,
            size: 14,
            color: color,
          ),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final bool isBanned;
  const _StatusBadge({required this.isBanned});

  @override
  Widget build(BuildContext context) {
    final color = isBanned ? AdminColors.magenta : AdminColors.success;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: color.withValues(alpha: 0.45)),
      ),
      child: Text(
        isBanned ? 'Suspendido' : 'Activo',
        style: TextStyle(
          color: color,
          fontSize: 11.5,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
