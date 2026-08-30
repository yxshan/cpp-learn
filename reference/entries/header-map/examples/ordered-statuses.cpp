#include <iostream>
#include <map>
#include <string>

int main() {
    const std::map<std::string, int> statuses{{"ok", 200}, {"created", 201}};
    for (const auto& [name, code] : statuses) {
        std::cout << name << '=' << code << '\n';
    }
}
