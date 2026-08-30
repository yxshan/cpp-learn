#include <iostream>
#include <string>

int main() {
    const std::string setting = "env=production";
    std::cout << "delimiter=" << setting.find('=') << '\n';
}
