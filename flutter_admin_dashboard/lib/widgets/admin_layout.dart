import 'package:flutter/material.dart';

import '../models/admin_models.dart';
import '../theme/admin_theme.dart';

enum AdminSection {
  dashboard,
  users,
  moderation,
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
    final isWide = MediaQuery.of(context).size.width >= 960;

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
            child: Scaffold(
              backgroundColor: AdminColors.background,
              appBar: _buildTopAppBar(
                context: context,
                showMenuButton: !isWide,
              ),
              body: body,
            ),
          ),
        ],
      ),
    );
  }

  PreferredSizeWidget _buildTopAppBar({
    required BuildContext context,
    required bool showMenuButton,
  }) {
    final screenWidth = MediaQuery.of(context).size.width;
    final showAdminDetails = screenWidth >= 760;
    final initial = adminUser.displayName.isNotEmpty
        ? adminUser.displayName[0].toUpperCase()
        : 'A';

    return AppBar(
      toolbarHeight: 74,
      automaticallyImplyLeading: false,
      backgroundColor: AdminColors.sidebar,
      shape: const Border(
        bottom: BorderSide(color: AdminColors.border, width: 1),
      ),
      titleSpacing: 20,
      title: Row(
        children: [
          if (showMenuButton) ...[
            Builder(
              builder: (ctx) => IconButton(
                onPressed: () => Scaffold.of(ctx).openDrawer(),
                icon: const Icon(
                  Icons.menu_rounded,
                  color: AdminColors.textPrimary,
                ),
              ),
            ),
            const SizedBox(width: 8),
          ],
          Expanded(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: TextField(
                controller: searchController,
                onChanged: onSearchChanged,
                style: const TextStyle(
                  color: AdminColors.textPrimary,
                  fontSize: 13.5,
                ),
                decoration: InputDecoration(
                  hintText: 'Buscar usuarios, correos, países o reportes...',
                  prefixIcon: const Icon(
                    Icons.search_rounded,
                    size: 19,
                    color: AdminColors.electricBlue,
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
        ],
      ),
      actions: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 13),
          child: Container(
            padding: EdgeInsets.symmetric(
              horizontal: showAdminDetails ? 12 : 6,
              vertical: 4,
            ),
            decoration: BoxDecoration(
              color: AdminColors.surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AdminColors.border),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                CircleAvatar(
                  radius: 16,
                  backgroundColor: AdminColors.magenta,
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
                if (showAdminDetails) ...[
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
                      Text(
                        adminUser.email,
                        style: const TextStyle(
                          color: AdminColors.electricBlue,
                          fontSize: 10.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(width: 12),
        Padding(
          padding: const EdgeInsets.only(right: 20, top: 15, bottom: 15),
          child: OutlinedButton.icon(
            onPressed: onSignOut,
            icon: const Icon(Icons.logout_rounded, size: 17),
            label: const Text('Cerrar Sesión'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AdminColors.magenta,
              side: BorderSide(
                color: AdminColors.magenta.withValues(alpha: 0.55),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              textStyle: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
      ],
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
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    gradient: const LinearGradient(
                      colors: [AdminColors.magenta, AdminColors.electricBlue],
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: AdminColors.magenta.withValues(alpha: 0.35),
                        blurRadius: 14,
                      ),
                    ],
                  ),
                  child: const Icon(
                    Icons.play_arrow_rounded,
                    color: Colors.white,
                    size: 26,
                  ),
                ),
                const SizedBox(width: 12),
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Viroklipz',
                      style: TextStyle(
                        color: AdminColors.textPrimary,
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
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
                label: const Text('Cerrar Sesión'),
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
                        AdminColors.magenta.withValues(alpha: 0.24),
                        AdminColors.electricBlue.withValues(alpha: 0.2),
                      ],
                    )
                  : null,
              border: Border.all(
                color: selected
                    ? AdminColors.magenta.withValues(alpha: 0.55)
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
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: AdminColors.magenta,
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
