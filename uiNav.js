/**
 * Created by ramon on 1/4/16.
 */

angular.module('orange.directives')
  .directive('uiNav', ['$menuService', '$compile', function($menuService, $compile) {
    /**
     *
     * @param {Menu} menu
     * @param {Scope} parentScope - the parent scope for this menu
     * @returns {[HtmlElement]|HtmlElement}
     */
    function _buildMenuDom(menu, parentScope) {
      if (angular.isArray(menu)) {
        var doms = [];
        angular.forEach(menu, function(item) {
          doms.push(_buildMenuDom(item, parentScope));
        });
        return doms;
      }

      var $scope = parentScope.$new(false);
      $scope.menu = menu;

      if (!menu.children || menu.children.length === 0) {
        var html = '<li ng-class="{active: isActive(menu)}" ng-show="menu.show()"><a ui-sref="{{menu.link}}" ng-click="onClick($event, menu, true)">{{menu.label}}</a></li>';
        if (menu.label === '-') {
          html = '<li role="separator" class="divider"></li>';
        }
        var dom = angular.element(html);
        $compile(dom)($scope);
        return dom[0];
      }

      return _buildDropdownMenuDom(menu, $scope);
    }

    /**
     *
     * @param {Menu} menu
     * @param {Scope} $scope - the scope for this menu
     * @returns {HtmlElement}
     */
    function _buildDropdownMenuDom(menu, $scope) {
      var html = '<li uib-dropdown ng-class="{active: isActive(menu)}" ng-show="menu.show()"> ' +
                    '<a uib-dropdown-toggle ng-click="onClick($event, menu, true)">{{menu.label}}<span class="caret"></span></a> ' +
                    '<ul uib-dropdown-menu role="menu"></ul>' +
                  '</li>';

      var dom = angular.element(html);
      $compile(dom)($scope);

      var subMenuDom = dom.find('ul');
      angular.forEach(menu.children, function(childMenu) {
        subMenuDom.append(_buildMenuDom(childMenu, $scope));
      });

      // update if new sub menu is added or removed
      $scope.$watch('menu.children.length', function() {
        _updateSubMenuItems(subMenuDom, menu, $scope);
      }, true);

      return dom[0];
    }

    /**
     *
     * @param {HtmlElement} subMenuDom - the dom element which contains sub menu doms
     * @param {Menu} menu - the menu data which has children to display as sub menus
     * @param {[Menu]} menu.children
     * @param {Scope} $scope - the scope for this menu
     */
    function _updateSubMenuItems(subMenuDom, menu, $scope) {
      var $menuDoms = subMenuDom.find('li');
      var menuItems = menu.children;

      // remove sub menu
      if ($menuDoms.length > menuItems.length) {
        angular.forEach($menuDoms, function(menuDom) {
          var $menuDom = angular.element(menuDom);
          var scopeMenu = $menuDom.scope().menu;
          for (var i = 0, len = menuItems.length; i < len; i++) {
            if (scopeMenu.id === menuItems[i].id) {
              return i; // menu is still there
            }
          }

          $menuDom.scope().$destroy();
          $menuDom.remove();
        });
      } else if ($menuDoms.length < menuItems.length) { // add sub menu
        angular.forEach(menuItems, function(menuItem, index) {
          for (var i = 0, len = $menuDoms.length; i < len; i++) {
            if (menuItem.id === angular.element($menuDoms[i]).scope().menu.id) {
              return i; // old menu
            }
          }

          var newSubMenu = _buildMenuDom(menuItem, $scope);
          var $currentMenuDoms = subMenuDom.find('li');
          if (index === 0) {
            if ($currentMenuDoms.length > 0) {
              angular.element($currentMenuDoms[index]).before(newSubMenu);
            } else {
              subMenuDom.append(newSubMenu);
            }
          } else {
            angular.element($currentMenuDoms[index - 1]).after(newSubMenu);
          }
        });
      }
    }

    return {
      restrict: 'E',
      templateUrl: 'directives/uiNav/uiNav.html',
      link: function($scope, $ele, attrs) {
        // TODO: better idea???
        $scope.navCollapsed = true;
        $scope.toggleNav = function() {
          var smallScreenWidth = 768;
          var isBtnNavBarToggleVisible = window.innerWidth < smallScreenWidth;
          if (isBtnNavBarToggleVisible) {
            $scope.navCollapsed = !$scope.navCollapsed;
          }
        };

        $scope.menus = $menuService.menus;
        $scope.rightMenus = $menuService.rightMenus;
        $scope.onClick = function($event, menu, isActive) {
          $scope.toggleNav();

          //if (isActive) {
          //  var $a = angular.element($event.currentTarget);
          //  var $ul = $a.parent().parent();
          //  angular.forEach($ul.find('li'), function(li) {
          //    var $li = angular.element(li);
          //    if ($li.hasClass('active')) {
          //      $li.removeClass('active');
          //    }
          //  });
          //  $a.parent().toggleClass('active');
          //}

          if (menu.onClick) {
            menu.onClick($event, menu);
          }
        };

        $scope.isActive = function(menu) {
          return $menuService.isActive(menu);
        };

        // draw navbar
        var $leftMenu = angular.element($ele.find('ul')[0]);
        var menuDoms = _buildMenuDom($scope.menus, $scope);
        $leftMenu.append(menuDoms);
      }
    };
  }])
  .factory('$menuService', ['lodash', function(_) {
    return {
      Position: {
        LEFT: 0,
        RIGHT: 1
      },

      /**
       * @class Menu
       * {String} id - unique id, separated by '.' like 'home.class', which means this menu is under 'home' menu
       * {String} label - displayed to user
       * {Number} [order = -1] - the order in one menu group, by default displayed as added order
       * {Boolean} [visible = true]
       * {String} [link] - url to link to, like 'home.class'
       * {function} [show] - determine if need show this menu
       * {function} [onClick] - callback when click this menu
       * {[Menu]} children = child menus
       *
       * [Menu]
       */
      menus: [],  // left menus

      rightMenus: [], // right menus

      /**
       * This function should be override if you wants to use your own logic to check menu active status.
       * @param menu
       * @returns {boolean}
       */
      isActive: function(menu) {
        return false;
      },

      /**
       *
       * @param {Object} options
       * @param {String} options.groupId - the target group to place this divider
       * @param {Number} options.order - this same to Menu.order
       * @param {String} [options.position = Position.LEFT] - left or right menus
       */
      addDivider: function(options) {
        var menu = {
          id: options.groupId + '.' + new Date().getTime(),
          label: '-',
          order: options.order
        };
        this.addMenu(menu);
      },

      /**
       *
       * @param {Menu} options - the menu options
       */
      addMenu: function(options) {
        var me = this;
        var parent = me._findParent(options.id, options.position);
        var menu = me._createMenu(options);

        var arr = options.position === me.Position.RIGHT ? me.rightMenus : me.menus;
        if (parent) {
          menu.parent = parent;
          parent.children = parent.children || [];
          arr = parent.children;
        }

        me._addMenuInOrder(arr, menu);
      },

      _findParent: function(childId, position) {
        var me = this;
        var parentId = me._getParentId(childId);
        if (!parentId) {
          return null;
        }

        return me.findMenu(parentId, position);
      },

      _getParentId: function(childId) {
        var index = childId.lastIndexOf('.');
        return index <= 0 ? null : childId.substr(0, index);
      },

      _createMenu: function(options) {
        return _.defaults({}, options, {
          children: [],
          visible: true,
          label: options.id,
          show: function() {
            return true;
          },
          onClick: function() {
            console.log('click ' + options.id);
          }
        });
      },

      _addMenuInOrder: function(arr, menu) {
        if (menu.order !== undefined) {
          for (var i = 0, len = arr.length; i < len; i++) {
            if (arr[i].order !== undefined && arr[i].order > menu.order) {
              arr.splice(i, 0, menu);
              return;
            }
          }
        }

        arr.push(menu);
      },

      /**
       *
       * @param id {String} - the id of menu to remove
       */
      removeMenu: function(id) {
        var me = this;
        var menu = me.findMenu(id);
        if (menu) {
          var menuArr = menu.parent ? menu.parent.children : me.menus;
          _.remove(menuArr, {id: id});
        }
      },

      setVisible: function(id, visible) {
        var me = this;
        var menu = me.findMenu(id);
        if (menu) {
          menu.visible = visible;
        }
      },

      findMenu: function(id, position) {
        var me = this;
        var menus = position === me.Position.RIGHT ? me.rightMenus : me.menus;
        for (var i = 0, len = menus.length; i < len; i++) {
          var menu = me._findMenu(id, menus[i]);
          if (menu) {
            return menu;
          }
        }

        return null;
      },

      _findMenu: function(id, parentMenu) {
        var me = this;
        if (parentMenu.id === id) {
          return parentMenu;
        }

        if (id.indexOf(parentMenu.id) === 0) {
          var len = parentMenu.children ? parentMenu.children.length : 0;
          for (var i = 0; i < len; i++) {
            var menu = me._findMenu(id, parentMenu.children[i]);
            if (menu) {
              return menu;
            }
          }
        }

        return null;
      }
    };
  }]);