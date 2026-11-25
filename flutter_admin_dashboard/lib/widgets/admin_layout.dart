import 'package:flutter/material.dart';

import '../models/admin_models.dart';
import '../theme/admin_theme.dart';

enum AdminSection {
  dashboard,
  users,
  moderation,
  finance,
  settings,
}

class AdminLayout extends StatelessWidget {
  final AdminUserModel adminUser;
  final AdminSection currentSection;
  final ValueChanged<AdminSection> onSelectSection;
  final TextEditingController searchController;
  final ValueChanged<String> onSearchChanged;
  final int pendingReportsCount;
  final VoidCallback onSignOut;
  final Widget body;

  const AdminLayout({
    super.key,
    required this.adminUser,
    required this.currentSection,
    required this.onSelectSection,
    required this.searchController,
    required this.onSearchChanged,
    required this.pendingReportsCount,
    required this.onSignOut,
    required this.body,
  });

  @override
  Widget build(BuildContext context) {
    final isWide = MediaQuery.of(context).size.width >= 1024;

    return Scaffold(
      backgroundColor: AdminColors.background,
      drawer: isWide
          ? null
          : Drawer(
              backgroundColor: AdminColors.sidebar,
              child: _SidebarContent(
                currentSection: currentSection,
                pendingReportsCount: pendingReportsCount,
                onSelectSection: (section) {
                  Navigator.of(context).pop();
                  onSelectSection(section);
                },
                onSignOut: onSignOut,
              ),
            ),
      body: Row(
        children: [
          if (isWide)
            SizedBox(
              width: 256,
              child: _SidebarContent(
                currentSection: currentSection,
                pendingReportsCount: pendingReportsCount,
                onSelectSection: onSelectSection,
                onSignOut: onSignOut,
              ),
            ),
          Expanded(
            child: Column(
              children: [
                _TopBar(
                  showMenuButton: !isWide,
                  adminUser: adminUser,
                  searchController: searchController,
                  onSearchChanged: onSearchChanged,
                  onSignOut: onSignOut,
                ),
                Expanded(
                  child: Container(
                    color: AdminColors.background,
                    child: body,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SidebarContent extends StatelessWidget {
  final AdminSection currentSection;
  final int pendingReportsCount;
  final ValueChanged<AdminSection> onSelectSection;
  final VoidCallback onSignOut;

  const _SidebarContent({
    required this.currentSection,
    required this.pendingReportsCount,
    required this.onSelectSection,
    required this.onSignOut,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AdminColors.sidebar,
        border: Border(
          right: BorderSide(color: AdminColors.border, width: 1),
        ),
      ),
      child: Column(
        children: [
          const SizedBox(height: 24),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(11),
                    gradient: const LinearGradient(
                      colors: [AdminColors.electricBlue, AdminColors.purple],
                    ),
                  ),
                  child: const Icon(
                    Icons.play_arrow_rounded,
                    color: Colors.white,
                    size: 24,
                  ),
                ),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Text(
                      'Viroklipz',
                      style: TextStyle(
                        color: AdminColors.textPrimary,
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      'Admin Console',
                      style: TextStyle(
                        color: AdminColors.electricBlue,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 28),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              children: [
                _NavTile(
                  icon: Icons.dashboard_rounded,
                  label: 'Dashboard',
                  selected: currentSection == AdminSection.dashboard,
                  onTap: () => onSelectSection(AdminSection.dashboard),
                ),
                _NavTile(
                  icon: Icons.people_alt_rounded,
                  label: 'Usuarios',
                  selected: currentSection == AdminSection.users,
                  onTap: () => onSelectSection(AdminSection.users),
                ),
                _NavTile(
                  icon: Icons.shield_rounded,
                  label: 'Moderación',
                  badgeCount: pendingReportsCount,
                  selected: currentSection == AdminSection.moderation,
                  onTap: () => onSelectSection(AdminSection.moderation),
                ),
                _NavTile(
                  icon: Icons.account_balance_wallet_rounded,
                  label: 'Finanzas',
                  selected: currentSection == AdminSection.finance,
                  onTap: () => onSelectSection(AdminSection.finance),
                ),
                _NavTile(
                  icon: Icons.settings_rounded,
                  label: 'Ajustes',
                  selected: currentSection == AdminSection.settings,
                  onTap: () => onSelectSection(AdminSection.settings),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.all(14),
            child: SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: onSignOut,
                icon: const Icon(Icons.logout_rounded, size: 17),
                label: const Text('Cerrar sesión'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AdminColors.textSecondary,
                  side: const BorderSide(color: AdminColors.border),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _NavTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final int badgeCount;
  final VoidCallback onTap;

  const _NavTile({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
    this.badgeCount = 0,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(13),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(13),
              gradient: selected
                  ? LinearGradient(
                      colors: [
                        AdminColors.royalBlue.withValues(alpha: 0.25),
                        AdminColors.purple.withValues(alpha: 0.25),
                      ],
                    )
                  : null,
              border: Border.all(
                color: selected
                    ? AdminColors.electricBlue.withValues(alpha: 0.45)
                    : Colors.transparent,
              ),
            ),
            child: Row(
              children: [
                Icon(
                  icon,
                  size: 20,
                  color: selected
                      ? AdminColors.electricBlue
                      : AdminColors.textSecondary,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    label,
                    style: TextStyle(
                      color: selected
                          ? AdminColors.textPrimary
                          : AdminColors.textSecondary,
                      fontSize: 13.5,
                      fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                    ),
                  ),
                ),
                if (badgeCount > 0)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: AdminColors.danger,
                      borderRadius: BorderRadius.circular(99),
                    ),
                    child: Text(
                      '$badgeCount',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  final bool showMenuButton;
  final AdminUserModel adminUser;
  final TextEditingController searchController;
  final ValueChanged<String> onSearchChanged;
  final VoidCallback onSignOut;

  const _TopBar({
    required this.showMenuButton,
    required this.adminUser,
    required this.searchController,
    required this.onSearchChanged,
    required this.onSignOut,
  });

  @override
  Widget build(BuildContext context) {
    final initial = adminUser.displayName.isNotEmpty
        ? adminUser.displayName[0].toUpperCase()
        : 'A';

    return Container(
      height: 74,
      padding: const EdgeInsets.symmetric(horizontal: 24),
      decoration: const BoxDecoration(
        color: AdminColors.sidebar,
        border: Border(
          bottom: BorderSide(color: AdminColors.border, width: 1),
        ),
      ),
      child: Row(
        children: [
          if (showMenuButton) ...[
            Builder(
              builder: (ctx) => IconButton(
                onPressed: () => Scaffold.of(ctx).openDrawer(),
                icon: const Icon(Icons.menu_rounded, color: AdminColors.textPrimary),
              ),
            ),
            const SizedBox(width: 8),
          ],
          Expanded(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: TextField(
                controller: searchController,
                onChanged: onSearchChanged,
                style: const TextStyle(color: AdminColors.textPrimary, fontSize: 13.5),
                decoration: InputDecoration(
                  hintText: 'Buscar usuarios, correos, reportes o IDs...',
                  prefixIcon: const Icon(
                    Icons.search_rounded,
                    size: 19,
                    color: AdminColors.textMuted,
                  ),
                  suffixIcon: searchController.text.isNotEmpty
                      ? IconButton(
                          onPressed: () {
                            searchController.clear();
                            onSearchChanged('');
                          },
                          icon: const Icon(Icons.close_rounded, size: 17),
                        )
                      : null,
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 11,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 20),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: AdminColors.surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AdminColors.border),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                CircleAvatar(
                  radius: 17,
                  backgroundColor: AdminColors.purple,
                  backgroundImage: adminUser.avatarUrl.startsWith('http')
                      ? NetworkImage(adminUser.avatarUrl)
                      : null,
                  child: adminUser.avatarUrl.startsWith('http')
                      ? null
                      : Text(
                          initial,
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            fontSize: 13,
                          ),
                        ),
                ),
                const SizedBox(width: 10),
                Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      adminUser.displayName,
                      style: const TextStyle(
                        color: AdminColors.textPrimary,
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const Text(
                      'Administrador',
                      style: TextStyle(
                        color: AdminColors.electricBlue,
                        fontSize: 10.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 6),
                IconButton(
                  tooltip: 'Cerrar sesión',
                  onPressed: onSignOut,
                  icon: const Icon(
                    Icons.logout_rounded,
                    size: 17,
                    color: AdminColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
