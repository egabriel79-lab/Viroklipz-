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
    final targetBanned = !user.banned;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AdminColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: const BorderSide(color: AdminColors.border),
        ),
        title: Text(
          targetBanned ? 'Suspender cuenta' : 'Reactivar cuenta',
          style: const TextStyle(color: AdminColors.textPrimary),
        ),
        content: Text(
          targetBanned
              ? '¿Confirmas suspender a @${user.username}? Se guardará banned: true en Firestore.'
              : '¿Confirmas reactivar a @${user.username}? Se guardará banned: false en Firestore.',
          style: const TextStyle(color: AdminColors.textSecondary, fontSize: 13.5),
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
                  targetBanned ? AdminColors.danger : AdminColors.success,
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
        banned: targetBanned,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            targetBanned
                ? 'Cuenta @${user.username} suspendida.'
                : 'Cuenta @${user.username} reactivada.',
          ),
          backgroundColor:
              targetBanned ? AdminColors.danger : AdminColors.success,
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

  void _showUserProfileDialog(AdminUserModel user) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AdminColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: AdminColors.border),
        ),
        title: Row(
          children: [
            CircleAvatar(
              radius: 22,
              backgroundColor: AdminColors.purple,
              backgroundImage: user.avatarUrl.startsWith('http')
                  ? NetworkImage(user.avatarUrl)
                  : null,
              child: user.avatarUrl.startsWith('http')
                  ? null
                  : Text(
                      user.displayName.isNotEmpty
                          ? user.displayName[0].toUpperCase()
                          : 'U',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    user.displayName,
                    style: const TextStyle(
                      color: AdminColors.textPrimary,
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  Text(
                    '@${user.username}',
                    style: const TextStyle(
                      color: AdminColors.electricBlue,
                      fontSize: 12.5,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        content: SizedBox(
          width: 400,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _DetailRow(label: 'UID', value: user.uid),
              _DetailRow(label: 'Correo', value: user.email),
              _DetailRow(label: 'País', value: user.country),
              _DetailRow(label: 'Monedas', value: '${user.coins}'),
              _DetailRow(label: 'Seguidores', value: '${user.followersCount}'),
              _DetailRow(label: 'Nivel de Fan', value: 'Nivel ${user.fanLevel}'),
              _DetailRow(
                label: 'Estado',
                value: user.banned ? 'Suspendido (banned: true)' : 'Activo',
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cerrar'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final query = widget.searchQuery.trim().toLowerCase();
    final filteredUsers = widget.users.where((u) {
      if (_statusFilter == 'active' && u.banned) return false;
      if (_statusFilter == 'banned' && !u.banned) return false;
      if (query.isEmpty) return true;
      return u.displayName.toLowerCase().contains(query) ||
          u.username.toLowerCase().contains(query) ||
          u.email.toLowerCase().contains(query) ||
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
                    'Administra cuentas, revisa perfiles y suspende usuarios infractores',
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
                            columnSpacing: 20,
                            dataRowMinHeight: 58,
                            dataRowMaxHeight: 68,
                            columns: const [
                              DataColumn(label: Text('Avatar')),
                              DataColumn(label: Text('Nombre')),
                              DataColumn(label: Text('Email')),
                              DataColumn(label: Text('Monedas')),
                              DataColumn(label: Text('Seguidores')),
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
                                      backgroundColor: AdminColors.royalBlue,
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
                                            if (user.isAdmin) ...[
                                              const SizedBox(width: 6),
                                              Container(
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                  horizontal: 6,
                                                  vertical: 2,
                                                ),
                                                decoration: BoxDecoration(
                                                  color: AdminColors.purple
                                                      .withValues(alpha: 0.25),
                                                  borderRadius:
                                                      BorderRadius.circular(6),
                                                ),
                                                child: const Text(
                                                  'ADMIN',
                                                  style: TextStyle(
                                                    color: AdminColors
                                                        .electricBlue,
                                                    fontSize: 9.5,
                                                    fontWeight: FontWeight.w800,
                                                  ),
                                                ),
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
                                    Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        const Icon(
                                          Icons.monetization_on_rounded,
                                          size: 16,
                                          color: AdminColors.warning,
                                        ),
                                        const SizedBox(width: 5),
                                        Text(
                                          '${user.coins}',
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  DataCell(Text('${user.followersCount}')),
                                  DataCell(_StatusBadge(banned: user.banned)),
                                  DataCell(
                                    Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        OutlinedButton.icon(
                                          onPressed: () =>
                                              _showUserProfileDialog(user),
                                          icon: const Icon(
                                            Icons.visibility_outlined,
                                            size: 15,
                                          ),
                                          label: const Text('Ver Perfil'),
                                          style: OutlinedButton.styleFrom(
                                            foregroundColor:
                                                AdminColors.electricBlue,
                                            side: const BorderSide(
                                              color: AdminColors.border,
                                            ),
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 12,
                                              vertical: 10,
                                            ),
                                            textStyle: const TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        ElevatedButton.icon(
                                          onPressed: isBusy
                                              ? null
                                              : () => _handleToggleBan(user),
                                          icon: Icon(
                                            user.banned
                                                ? Icons.check_circle_outline
                                                : Icons.block_rounded,
                                            size: 15,
                                          ),
                                          label: Text(
                                            user.banned
                                                ? 'Reactivar'
                                                : 'Suspender Cuenta',
                                          ),
                                          style: ElevatedButton.styleFrom(
                                            backgroundColor: user.banned
                                                ? AdminColors.success
                                                : AdminColors.danger,
                                            foregroundColor: Colors.white,
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 12,
                                              vertical: 10,
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

class _StatusBadge extends StatelessWidget {
  final bool banned;
  const _StatusBadge({required this.banned});

  @override
  Widget build(BuildContext context) {
    final color = banned ? AdminColors.danger : AdminColors.success;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: color.withValues(alpha: 0.45)),
      ),
      child: Text(
        banned ? 'Suspendido' : 'Activo',
        style: TextStyle(
          color: color,
          fontSize: 11.5,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;
  const _DetailRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: const TextStyle(
                color: AdminColors.textMuted,
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Expanded(
            child: SelectableText(
              value,
              style: const TextStyle(
                color: AdminColors.textPrimary,
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
