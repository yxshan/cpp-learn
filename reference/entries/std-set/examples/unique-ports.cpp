#include <iostream>
#include <set>

int main() {
    const std::set<int> ports{8080, 443, 80, 443};

    for (const int port : ports) {
        std::cout << port << (port == *ports.rbegin() ? '\n' : ' ');
    }
}
